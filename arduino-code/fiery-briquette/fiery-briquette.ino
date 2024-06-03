#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
int temperature = 0;

// For testing
bool countUp = true;
int MIN_TEMP = 50;
int MAX_TEMP = 350;
int DEFAULT_TEMP = 150;

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

  // For testing
  temperature = DEFAULT_TEMP;
}

void loop() {
  if (deviceConnected) {
        pCharacteristic->setValue(String(temperature).c_str());
        pCharacteristic->notify();

        // For testing
        if (countUp) temperature += 10;
        else temperature -= 10;
        if (temperature > MAX_TEMP) countUp = false;
        else if (temperature < MIN_TEMP) countUp = true;

        delay(1000); // Prevents bluetooth stack from congesting
    }
    
    if (!deviceConnected && oldDeviceConnected) {
        handleDisconnect();
    }
    
    if (deviceConnected && !oldDeviceConnected) {
        handleConnect();
    }
}