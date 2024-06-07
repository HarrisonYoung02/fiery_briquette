#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

int ThermistorPin = A1;
int Vo;
float RKnown = 100000;
float logRTherm, RTherm, T;
float c1 = 2.397488323e-3, c2 = -0.01514706551e-4, c3 = 6.189831727e-7;

#define SERVICE_UUID        "7f47e0be-878d-45b9-9bc7-11794a65c5e9"
#define CHARACTERISTIC_UUID "52fc7e02-ab71-48d9-8cb4-48e5341a83d5"

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  BLEDevice::init("Fiery Briquette");

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_NOTIFY
                      );

  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();
}

void handleDisconnect() {
  delay(500); // give the bluetooth stack the chance to get things ready
  pServer->startAdvertising();
  oldDeviceConnected = deviceConnected;
}

void handleConnect() {
  oldDeviceConnected = deviceConnected;
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
  if (deviceConnected) {
        pCharacteristic->setValue(String(getTemperature()).c_str());
        pCharacteristic->notify();

        delay(3); // Prevents bluetooth stack from congesting
    }
    
    if (!deviceConnected && oldDeviceConnected) {
        handleDisconnect();
    }
    
    if (deviceConnected && !oldDeviceConnected) {
        handleConnect();
    }
}