#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>

BLEService temperatureService("7f47e0be-878d-45b9-9bc7-11794a65c5e9");
BLEStringCharacteristic temperatureCharacteristic("52fc7e02-ab71-48d9-8cb4-48e5341a83d5", BLENotify | BLERead, 7);

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