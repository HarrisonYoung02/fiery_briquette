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

  float tempC = tempCArr[(int)(DATA_SIZE / 2)];
  if (isnan(tempC)) tempC = 0;
  float tempF = tempC * 1.8 + 32.0;

  boolean tooCold = false;
  boolean tooHot = false;
  if (tempInF) {
    if (tempF < lowTempF) {
      tooCold = true;
    } else if (tempF > highTempF) {
      tooHot = true;
    }
  } else {
    if (tempC < lowTempC) {
      tooCold = true;
    } else if (tempC > highTempC) {
      tooHot = true;
    }
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
      client.println(R"rawliteral(
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
                    font-size: 5em;
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
                    font-size: 3em;
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
                    font-size: 1.5em;
                  }
                  .temp-limits-box {
                    display: flex;
                    flex-direction: row;
                  }
                  .temp-limit {
                    display: flex;
                    flex-direction: column;
                    margin: 0.5em;
                  }
                  .temp-limit span {
                    text-align: center;
                    font-size: 1.5em;
                    margin: 0.25em;
                  }
                  .temp-limit button {
                    font-size: 1.5em;
                    padding: 0.25em;
                    border-radius: 1em;
                    background: rgb(255, 248, 180);
                    cursor: pointer;
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
                    font-size: 1.5em;
                    padding: 0.5em;
                    border-radius: 2em;
                    background: rgb(255, 248, 180);
                    cursor: pointer;
                  }
                </style>
              </head>
              <body>
                <h1 id="page-title">Fiery Briquette</h1>
                <div class="temp-display">
      )rawliteral");

      client.println("<div class=\"temp-box ");
      if (tooCold) {
        client.println("too-cold");
      } else if (tooHot) {
        client.println("too-hot");
      }
      client.println("\">");
      if (tempInF) {
        client.println(tempF);
        client.println(" &#8457;");
      } else {
        client.println(tempC);
        client.println(" &#8451;");
      }
      client.println("</div>");

      if (tooCold) {
        client.println("<div class=\"temp-warning\"><span>Temperature is too cold!</span></div>");
      } else if (tooHot) {
        client.println("<div class=\"temp-warning\"><span>Temperature is too hot!</span></div>");
      } else {
        client.println("<div class=\"temp-warning hidden\"><span>Temperature is within limits</span></div>");
      }

      client.println("<div class=\"temp-limits-box\">");
      client.println("<div class=\"temp-limit\">");
      client.println("<span>Low Limit: ");
      if (tempInF) {
        client.println(lowTempF);
        client.println(" &#8457;");
      } else {
        client.println(lowTempC);
        client.println(" &#8451;");
      }
      client.println("</span>");
      client.println("<button onclick=\"setLow()\">Set Low</button>");
      client.println("</div>");
      client.println("<div class=\"temp-limit\">");
      client.println("<span>High Limit: ");
      if (tempInF) {
        client.println(highTempF);
        client.println(" &#8457;");
      } else {
        client.println(highTempC);
        client.println(" &#8451;");
      }
      client.println("</span>");
      client.println("<button onclick=\"setHigh()\">Set High</button>");
      client.println("</div>");
      client.println("</div>");
      client.println("</div>");

      client.println("<button onclick=\"switchTempScale()\" class=\"switch-temp-scale\"><span>Use</span><span>");
      if (tempInF) {
        client.println("Celsius");
      } else {
        client.println("Fahrenheit");
      }
      client.println("</span></button>");

      client.println(R"rawliteral(
                <script>
                  async function setLow() {
      )rawliteral");
      if (tempInF) {
        client.println("const temp = prompt(\"Enter low temperature limit in Fahrenheit:\", ");
        client.println(lowTempF);
        client.println(");");
      } else {
        client.println("const temp = prompt(\"Enter low temperature limit in Celsius:\", ");
        client.println(lowTempC);
        client.println(");");
      }
      client.println(R"rawliteral(
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
        client.println("const temp = prompt(\"Enter high temperature limit in Fahrenheit:\", ");
        client.println(highTempF);
        client.println(");");
      } else {
        client.println("const temp = prompt(\"Enter high temperature limit in Celsius:\", ");
        client.println(highTempC);
        client.println(");");
      }
      client.println(R"rawliteral(
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
      //   client.println("<p>ADC raw: ");
      //   client.println(adc0DataArr[i]);
      //   client.println(" ADC voltage: ");
      //   client.println(volts0DataArr[i], 5);
      //   client.println(" Supply voltage: ");
      //   client.println(supplyVoltsDataArr[i], 5);
      //   client.println(" Thermistor resistance: ");
      //   client.println(RThermDataArr[i], 1);
      //   client.println(" Temperature C: ");
      //   client.println(TDataArr[i], 2);
      //   client.println("</p>");
      // }

      client.println(R"rawliteral(
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