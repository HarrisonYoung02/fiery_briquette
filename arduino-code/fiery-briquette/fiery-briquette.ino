#include <WiFiS3.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

#include "arduino_secrets.h"

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
int keyIndex = 0;

int status = WL_IDLE_STATUS;

WiFiServer server(80);

Adafruit_ADS1115 ads;

int ThermistorPin = 0;
int supplyVoltPin = 1;
float volts0, supplyVolts;
int16_t adc0, adc1;
float RKnown = 98500;
float logRTherm, RTherm, T;
float c1 = 0.0007429767295319737, c2 = 0.00021170687252114286, c3 = 0.00000011425980418839938;

int dataIndex = 0;
const int DATA_SIZE = 11;
float supplyVoltsDataArr[DATA_SIZE];
float volts0DataArr[DATA_SIZE];
int16_t adc0DataArr[DATA_SIZE];
float RThermDataArr[DATA_SIZE];
float TDataArr[DATA_SIZE];

boolean tempInF = true;
float lowTempF = 200;
float lowTempC = (lowTempF - 32) / 1.8;
float highTempF = 325;
float highTempC = (highTempF - 32) / 1.8;

void setup() {
  // analogReadResolution(14);
  Serial.begin(9600);
  ads.begin();
  while (!Serial)
    ;

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Communication with WiFi module failed!");
    while (true)
      ;
  }

  String fv = WiFi.firmwareVersion();
  if (fv < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("Please upgrade the firmware");
  }

  while (status != WL_CONNECTED) {
    Serial.print("Attempting to connect to SSID: ");
    Serial.println(ssid);
    status = WiFi.begin(ssid, pass);
    delay(10000);
  }
  server.begin();
  printWifiStatus();
}

void getTemperature() {
  adc0 = ads.readADC_SingleEnded(ThermistorPin);
  adc1 = ads.readADC_SingleEnded(supplyVoltPin);
  volts0 = ads.computeVolts(adc0);
  supplyVolts = ads.computeVolts(adc1);
  RTherm = RKnown * (supplyVolts / volts0 - 1.0);
  logRTherm = log(RTherm);
  T = (1.0 / (c1 + c2 * logRTherm + c3 * logRTherm * logRTherm * logRTherm));
  T = T - 273.15;

  adc0DataArr[dataIndex] = adc0;
  volts0DataArr[dataIndex] = volts0;
  supplyVoltsDataArr[dataIndex] = supplyVolts;
  RThermDataArr[dataIndex] = RTherm;
  TDataArr[dataIndex] = T;
  dataIndex++;
  if (dataIndex >= DATA_SIZE) {
    dataIndex = 0;
  }
}

int sortAsc(const void *a, const void *b) {
  int x = *(const int *)a;
  int y = *(const int *)b;
  return x - y;
}

void webServer() {
  // Temp at the moment of reading is always wrong for some reason, so taking the median of the last several temps instead
  float tempCArr[DATA_SIZE];
  memcpy(tempCArr, TDataArr, sizeof(tempCArr));
  qsort(tempCArr, DATA_SIZE, sizeof(tempCArr[0]), sortAsc);

  float currentTempVal = tempCArr[(int)(DATA_SIZE / 2)];
  if (isnan(currentTempVal)) currentTempVal = 0;

  float lowTempVal = lowTempC;
  float highTempVal = highTempC;
  String currentTempLabel = String(currentTempVal, 2) + " &#8451;";
  String lowTempLabel = String(lowTempVal, 2) + " &#8451;";
  String highTempLabel = String(highTempVal, 2) + " &#8451;";

  if (tempInF) {
    currentTempVal = currentTempVal * 1.8 + 32.0;
    lowTempVal = lowTempF;
    highTempVal = highTempF;
    currentTempLabel = String(currentTempVal, 2) + " &#8457;";
    lowTempLabel = String(lowTempVal, 2) + " &#8457;";
    highTempLabel = String(highTempVal, 2) + " &#8457;";
  }

  boolean tooCold = false;
  boolean tooHot = false;
  if (currentTempVal < lowTempVal) {
    tooCold = true;
  } else if (currentTempVal > highTempVal) {
    tooHot = true;
  }

  WiFiClient client = server.available();
  if (client) {
    Serial.println("new client");
    const unsigned long REQUEST_TIMEOUT = 3000;
    unsigned long lastDataTime = millis();
    boolean requestComplete = false;
    String currentLine = "";

    while (client.connected() && !requestComplete && millis() - lastDataTime < REQUEST_TIMEOUT) {
      if (client.available()) {
        char c = client.read();
        Serial.write(c);
        lastDataTime = millis();

        if (c == '\n' && currentLine.length() == 0) {
          requestComplete = true;
          break;
        }
        if (c == '\n') {
          currentLine = "";
        } else if (c != '\r') {
          currentLine += c;
        }

        if (currentLine.startsWith("GET /setTemp")) {
          String tempStr = extractHeaderParam(currentLine, "temp");
          float temp = tempStr.toFloat();

          if (currentLine.startsWith("GET /setTemp/low")) {
            setLowTemp(temp);
          } else if (currentLine.startsWith("GET /setTemp/high")) {
            setHighTemp(temp);
          }
        } else if (currentLine.startsWith("GET /switchTempScale")) {
          tempInF = !tempInF;
        }
      }
    }

    if (requestComplete) {
      client.println("HTTP/1.1 200 OK");
      client.println("Content-Type: text/html");
      client.println("Connection: close");
      client.println("Refresh: 60");
      client.println();
      client.print(R"rawliteral(
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  .hidden {
                    visibility: hidden;
                  }
                  button {
                    background: rgb(255, 248, 180);
                    cursor: pointer;
                  }
                  button:hover {
                    background: rgb(255, 252, 216);
                  }
                  button:active {
                    background: rgb(255, 236, 62);
                  }
                  #page-title {
                    text-align: center;
                    font-size: 6em;
                  }
                  .temp-display {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 1em;
                  }
                  .temp-box {
                    display: inline;
                    text-align: center;
                    font-size: 4em;
                    font-weight: bold;
                    color: white;
                    background: rgb(255, 205, 41);
                    border: 0.15em solid black;
                    border-radius: 0.75em;
                    padding: 0.5em;
                    text-shadow: 2px 2px 2px black;
                  }
                  .too-cold {
                    background: rgb(0, 140, 255);
                  }
                  .too-hot {
                    background: rgb(253, 46, 19);
                  }
                  .temp-warning {
                    display: flex;
                    align-items: center;
                    margin: 0.5em;
                    color: red;
                    font-weight: bold;
                    font-size: 2em;
                  }
                  .switch-temp-scale {
                    position: absolute;
                    bottom: 1em;
                    left: 1em;
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                    text-decoration: none;
                    color: black;
                    font-size: 3em;
                    padding: 0.5em;
                    border-radius: 1.5em;
                    background: rgb(255, 248, 180);
                    cursor: pointer;
                  }
                  :has(> .temp-range) {
                    display: flex;
                    justify-content: center;
                  }
                  .temp-range {
                    display: flex;
                    align-items: center;
                    gap: 1em;
                    width: 95%;
                  }
                  .temp-range-label {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                  }
                  .temp-range-label span {
                    font-size: 3em;
                  }
                  .temp-range-label button {
                    font-size: 2.5em;
                    padding: 0.25em;
                    border-radius: 1em;
                    background: rgb(255, 248, 180);
                    width: 5em;
                  }
                  .temp-range-line {
                    position: relative;
                    flex: 1;
                    height: 0.25em;
                    background: #888;
                  }
                  .temp-range-marker {
                    position: absolute;
                    top: 50%;
                    width: 0.5em;
                    height: 2.5em;
                    background: #0d9488;
                    transform: translate(-50%, -50%);
      )rawliteral");
      client.print("left: ");
      client.print(max(0, min(100, (currentTempVal - lowTempVal) / (highTempVal - lowTempVal) * 100)));
      client.print("%;");
      client.print(R"rawliteral(
                  }
                </style>
              </head>
              <body>
                <h1 id="page-title">Fiery Briquette</h1>
                <div class="temp-display">
      )rawliteral");

      client.print("<div class=\"temp-box ");
      if (tooCold) {
        client.print("too-cold");
      } else if (tooHot) {
        client.print("too-hot");
      }
      client.print("\">");
      client.print(currentTempLabel);
      client.print("</div>");

      if (tooCold) {
        client.print("<div class=\"temp-warning\"><span>Temperature is too cold!</span></div>");
      } else if (tooHot) {
        client.print("<div class=\"temp-warning\"><span>Temperature is too hot!</span></div>");
      } else {
        client.print("<div class=\"temp-warning hidden\"><span>Temperature is within limits</span></div>");
      }
      client.print("</div>");

      client.print("<div>");
      client.print("<div class=\"temp-range\">");
      client.print("<div class=\"temp-range-label\">");
      client.print("<span>");
      client.print(lowTempLabel);
      client.print("</span>");
      client.print("<button onclick=\"setLow()\">Set Low</button>");
      client.print("</div>");
      client.print("<div class=\"temp-range-line\">");
      client.print("<div class=\"temp-range-marker\"></div>");
      client.print("</div>");
      client.print("<div class=\"temp-range-label\">");
      client.print("<span>");
      client.print(highTempLabel);
      client.print("</span>");
      client.print("<button onclick=\"setHigh()\">Set High</button>");
      client.print("</div>");
      client.print("</div>");
      client.print("</div>");

      client.print("<button onclick=\"switchTempScale()\" class=\"switch-temp-scale\"><span>Use ");
      if (tempInF) {
        client.print("&#8451;");
      } else {
        client.print("&#8457;");
      }
      client.print("</span></button>");

      client.print(R"rawliteral(
                <script>
                  async function setLow() {
      )rawliteral");
      if (tempInF) {
        client.print("const temp = prompt(\"Enter low temperature limit in Fahrenheit:\", ");
      } else {
        client.print("const temp = prompt(\"Enter low temperature limit in Celsius:\", ");
      }
      client.print(lowTempVal);
      client.print(");");
      client.print(R"rawliteral(
                    if (temp !== null && temp.trim() !== "") {
                      if (isNaN(parseFloat(temp))) {
                        alert("Please enter the limit as a number.");
                        return;
                      }
                      await fetch("/setTemp/low?temp=" + encodeURIComponent(temp));
                      location.reload();
                    }
                  }

                  async function setHigh() {
      )rawliteral");
      if (tempInF) {
        client.print("const temp = prompt(\"Enter high temperature limit in Fahrenheit:\", ");
      } else {
        client.print("const temp = prompt(\"Enter high temperature limit in Celsius:\", ");
      }
      client.print(highTempVal);
      client.print(");");
      client.print(R"rawliteral(
                    if (temp !== null && temp.trim() !== "") {
                      if (isNaN(parseFloat(temp))) {
                        alert("Please enter the limit as a number.");
                        return;
                      }
                      await fetch("/setTemp/high?temp=" + encodeURIComponent(temp));
                      location.reload();
                    }
                  }
                  async function switchTempScale() {
                    await fetch("/switchTempScale");
                    location.reload();
                  }
                </script>
      )rawliteral");

      // Keeping this in for future debugging
      // for (int i = 0; i < DATA_SIZE; i++) {
      //   client.print("<p>ADC raw: ");
      //   client.print(adc0DataArr[i]);
      //   client.print(" ADC voltage: ");
      //   client.print(volts0DataArr[i], 5);
      //   client.print(" Supply voltage: ");
      //   client.print(supplyVoltsDataArr[i], 5);
      //   client.print(" Thermistor resistance: ");
      //   client.print(RThermDataArr[i], 1);
      //   client.print(" Temperature C: ");
      //   client.print(TDataArr[i], 2);
      //   client.print("</p>");
      // }

      client.print(R"rawliteral(
              </body>
            </html>
      )rawliteral");
    } else {
      Serial.println("\nRequest timed out or client disconnected");
    }

    delay(1);  // give the web browser time to receive the data

    client.stop();
    Serial.println("client disconnected");
  }
}

void printWifiStatus() {
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());

  IPAddress ip = WiFi.localIP();
  Serial.print("IP Address: ");
  Serial.println(ip);

  long rssi = WiFi.RSSI();
  Serial.print("signal strength (RSSI):");
  Serial.print(rssi);
  Serial.println(" dBm");

  byte mac[6];
  WiFi.macAddress(mac);
  Serial.print("MAC address: ");
  printMacAddress(mac);
}

void printMacAddress(byte mac[]) {
  for (int i = 0; i < 6; i++) {
    if (i > 0) {
      Serial.print(":");
    }
    if (mac[i] < 16) {
      Serial.print("0");
    }
    Serial.print(mac[i], HEX);
  }
  Serial.println();
}

void loop() {
  getTemperature();
  webServer();
}

void setLowTemp(float newTemp) {
  if (tempInF) {
    lowTempF = newTemp;
    lowTempC = (lowTempF - 32) / 1.8;
  } else {
    lowTempC = newTemp;
    lowTempF = lowTempC * 1.8 + 32;
  }
}

void setHighTemp(float newTemp) {
  if (tempInF) {
    highTempF = newTemp;
    highTempC = (highTempF - 32) / 1.8;
  } else {
    highTempC = newTemp;
    highTempF = highTempC * 1.8 + 32;
  }
}

String extractHeaderParam(String request, String param) {
  int start = request.indexOf('?');
  if (start == -1) return "";

  int end = request.indexOf(' ', start + 1);
  if (end == -1) return "";

  String strParams = request.substring(start + 1, end);

  start = strParams.indexOf(param + "=") + param.length() + 1;
  if (start == -1) return "";

  end = strParams.indexOf("&", start);
  if (end == -1) end = strParams.length();

  return urlDecode(strParams.substring(start, end));
}

String urlDecode(String input) {
  String result;
  char c;
  char hex[3] = { 0, 0, 0 };

  for (int i = 0; i < input.length(); i++) {
    c = input.charAt(i);

    if (c == '+') {
      result += ' ';
    } else if (c == '%' && i + 2 < input.length()) {
      hex[0] = input.charAt(i + 1);
      hex[1] = input.charAt(i + 2);

      result += (char)strtol(hex, nullptr, 16);
      i += 2;
    } else {
      result += c;
    }
  }

  return result;
}