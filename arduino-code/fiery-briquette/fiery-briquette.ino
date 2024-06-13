#include <ArduinoBLE.h>

BLEService temperatureService("7f47e0be-878d-45b9-9bc7-11794a65c5e9");
BLEStringCharacteristic temperatureCharacteristic("52fc7e02-ab71-48d9-8cb4-48e5341a83d5", BLENotify | BLERead, 7);

int ThermistorPin = A0;
int Vo;
float RKnown = 98500;
float logRTherm, RTherm, T;
float c1 = 0.7429767295319737e-3, c2 = 2.1170687252114286e-4, c3 = 1.1425980418839938e-7;

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
  RTherm = RKnown * (16383.0 / (float)Vo - 1.0);
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