#include "WiFiS3.h"
#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

#include "arduino_secrets.h" 

char ssid[] = SECRET_SSID;
char pass[] = SECRET_PASS;
int keyIndex = 0;

int status = WL_IDLE_STATUS;

WiFiServer server(80);

// BLEService temperatureService("7f47e0be-878d-45b9-9bc7-11794a65c5e9");
// BLEStringCharacteristic temperatureCharacteristic("52fc7e02-ab71-48d9-8cb4-48e5341a83d5", BLENotify | BLERead, 7);

Adafruit_ADS1115 ads;

int ThermistorPin = 0;
float volts0;
int16_t adc0;
float RKnown = 98500;
float logRTherm, RTherm, T;
float c1 = 0.0007429767295319737, c2 = 0.00021170687252114286, c3 = 0.00000011425980418839938;
float MAX_VOLTS = 5.04;


void setup() {
  // analogReadResolution(14);
  Serial.begin(9600);
  ads.begin();
  while (!Serial);

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Communication with WiFi module failed!");
    while (true);
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
  
  // if (!BLE.begin()) {
  //   Serial.println("Failed to initialize BLE");
  //   while (1);
  // }

  // temperatureService.addCharacteristic(temperatureCharacteristic);
  // BLE.addService(temperatureService);
  // temperatureCharacteristic.writeValue("0");

  // BLE.setLocalName("Fiery Briquette");
  // BLE.setAdvertisedService(temperatureService);
  // BLE.advertise();
}

float getTemperature() {
  adc0 = ads.readADC_SingleEnded(ThermistorPin);
  volts0 = ads.computeVolts(adc0);
  RTherm = RKnown * (MAX_VOLTS / volts0 - 1.0);
  logRTherm = log(RTherm);
  T = (1.0 / (c1 + c2*logRTherm + c3*logRTherm*logRTherm*logRTherm));
  T = T - 273.15;

  if (isnan(T)) return 0;
  return T;
}

void webServer(String temperature) {
  // listen for incoming clients
  WiFiClient client = server.available();
  if (client) {
    Serial.println("new client");
    // an HTTP request ends with a blank line
    boolean currentLineIsBlank = true;
    while (client.connected()) {
      if (client.available()) {
        char c = client.read();
        Serial.write(c);
        // if you've gotten to the end of the line (received a newline
        // character) and the line is blank, the HTTP request has ended,
        // so you can send a reply
        if (c == '\n' && currentLineIsBlank) {
          // send a standard HTTP response header
          client.println("HTTP/1.1 200 OK");
          client.println("Content-Type: text/html");
          client.println("Connection: close");  // the connection will be closed after completion of the response
          client.println("Refresh: 5");  // refresh the page automatically every 5 sec
          client.println();
          client.println("<!DOCTYPE HTML>");
          client.println("<html>");
          client.println("<p>");
          client.println(temperature);
          client.println("</p>");
          client.println("</html>");
          break;
        }
        if (c == '\n') {
          // you're starting a new line
          currentLineIsBlank = true;
        } else if (c != '\r') {
          // you've gotten a character on the current line
          currentLineIsBlank = false;
        }
      }
    }
    // give the web browser time to receive the data
    delay(1);

    // close the connection:
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
}

void loop() {
  String temperature = String(getTemperature());
  webServer(temperature);

  // BLEDevice central = BLE.central();

  // if (central) {
  //   while (central.connected()) {
  //     temperatureCharacteristic.writeValue(String(getTemperature()));
  //     delay(1000); // Prevents bluetooth stack from congesting
  //   }

  //   delay(500); // Gives the bluetooth stack the chance to get things ready after disconnect
  //   BLE.advertise();
  // }
}