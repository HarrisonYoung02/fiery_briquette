#include <ArduinoBLE.h>

#define SERVICE_UUID        "7f47e0be-878d-45b9-9bc7-11794a65c5e9"
#define CHARACTERISTIC_UUID "52fc7e02-ab71-48d9-8cb4-48e5341a83d5"

BLEService temperatureService(SERVICE_UUID);
BLEStringCharacteristic temperatureCharacteristic(CHARACTERISTIC_UUID, BLENotify | BLERead, 3);

int ThermistorPin = A0;
int Vo;
float RKnown = 100000;
float logRTherm, RTherm, T;
float c1 = 2.397488323e-3, c2 = -0.01514706551e-4, c3 = 6.189831727e-7;

void setup() {
  analogReadResolution(14);
  Serial.begin(9600);
  while (!Serial);
  
  if (!BLE.begin()) {
    Serial.println("Failed to initialize BLE");
    while (1);
  }

  temperatureService.addCharacteristic(temperatureCharacteristic);
  BLE.addService(temperatureService);
  temperatureCharacteristic.writeValue("0");

  BLE.setLocalName("Fiery Briquette");
  BLE.setAdvertisedService(temperatureService);
  BLE.advertise();
}

int getTemperature() {
  Vo = analogRead(ThermistorPin);
  return Vo;
  RTherm = RKnown * (4095.0 / (float)Vo - 1.0);
  logRTherm = log(RTherm);
  T = (1.0 / (c1 + c2*logRTherm + c3*logRTherm*logRTherm*logRTherm));
  T = T - 273.15;
  return T;
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    while (central.connected()) {
      temperatureCharacteristic.writeValue(String(getTemperature()));

      delay(1000); // Prevents bluetooth stack from congesting
    }

    delay(500); // Gives the bluetooth stack the chance to get things ready after disconnect
    BLE.advertise();
  }
}