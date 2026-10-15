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
float volts0;
int16_t adc0;
float RKnown = 98500;
float logRTherm, RTherm, T;
float c1 = 0.0007429767295319737, c2 = 0.00021170687252114286, c3 = 0.00000011425980418839938;
float MAX_VOLTS = 5.04;

int logIndex = 0;
const int LOG_END = 50;
float volts0Arr[LOG_END];
int16_t adc0Arr[LOG_END];
float RThermArr[LOG_END];
float TArr[LOG_END];

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

float getTemperature() {
  adc0 = ads.readADC_SingleEnded(ThermistorPin);
  volts0 = ads.computeVolts(adc0);
  RTherm = RKnown * (MAX_VOLTS / volts0 - 1.0);
  logRTherm = log(RTherm);
  T = (1.0 / (c1 + c2 * logRTherm + c3 * logRTherm * logRTherm * logRTherm));
  T = T - 273.15;

  if (logIndex < LOG_END && adc0 >= 1) {
    adc0Arr[logIndex] = adc0;
    volts0Arr[logIndex] = volts0;
    RThermArr[logIndex] = RTherm;
    TArr[logIndex] = T;
    logIndex++;
  }

  if (isnan(T)) return 0;
  return T;
}

void webServer(float tempC) {
  float tempF = tempC * 1.8 + 32.0;

  WiFiClient client = server.available();
  if (client) {
    Serial.println("new client");
    const unsigned long REQUEST_TIMEOUT = 3000;
    unsigned long lastDataTime = millis();
    boolean requestComplete = false;
    boolean currentLineIsBlank = true;  // an HTTP request ends with a blank line

    while (client.connected() && !requestComplete && millis() - lastDataTime < REQUEST_TIMEOUT) {
      if (client.available()) {
        char c = client.read();
        Serial.write(c);
        lastDataTime = millis();

        if (c == '\n' && currentLineIsBlank) {
          requestComplete = true;
          break;
        }
        if (c == '\n') {
          currentLineIsBlank = true;
        } else if (c != '\r') {
          currentLineIsBlank = false;
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
                  #page-title {
                    text-align: center;
                    font-size: 5em;
                  }
                  .temp-display {
                    display: flex;
                    justify-content: center;
                    padding: 1em;
                  }
                  .temp-box {
                    display: inline;
                    text-align: center;
                    font-size: 3em;
                    font-weight: bold;
                    color: white;
                    background: indianred;
                    border: 0.15em solid black;
                    border-radius: 0.75em;
                    padding: 0.5em;
                    text-shadow: 2px 2px 2px black;
                  }
                </style>
              </head>
              <body>
                <h1 id="page-title">Fiery Briquette</h1>
                <div class="temp-display">
                  <div class="temp-box">
          )rawliteral");
      client.println(tempF);
      client.println(" &#8457; | ");
      client.println(tempC);
      client.println(" &#8451;");
      client.println(R"rawliteral(
                  </div>
                </div>
          )rawliteral");

      for (int i = 0; i < logIndex; i++) {
        client.println("<p>ADC raw: ");
        client.println(adc0Arr[i]);
        client.println(" ADC voltage: ");
        client.println(volts0Arr[i], 5);
        client.println(" Thermistor resistance: ");
        client.println(RThermArr[i], 1);
        client.println(" Temperature C: ");
        client.println(TArr[i], 2);
        client.println("</p>");
      }

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
  float temperature = getTemperature();
  webServer(temperature);
}