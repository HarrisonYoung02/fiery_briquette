import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { Device } from "react-native-ble-plx";
import BackgroundService from "react-native-background-actions";
import DismissKeyboard from "@/components/DismissKeyboard";
import AnimatedTempDial from "@/components/AnimatedTempDial";
import DeviceModal from "@/components/DeviceConnectionModal";
import useBLE from "@/hooks/useBLE";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const filterNumInput = (numStr: string): string =>
  numStr.toString().replace(/[^0-9]/g, "");

const sleep = (time: any) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), time));

export default function Index(): React.ReactNode {
  const {
    requestPermissions,
    scanForPeripherals,
    allDevices,
    connectToDevice,
    connectedDevice,
    temperature,
    disconnectFromDevice,
  } = useBLE();
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [tryingConnection, setTryingConnection] = useState<boolean>(false);

  const LOW_TEMP_STR_DEFAULT = "Set Low";
  const HIGH_TEMP_STR_DEFAULT = "Set High";
  const LOW_TEMP_DEFAULT = 40; // Defaults in Celsius
  const HIGH_TEMP_DEFAULT = 150;
  const [lowTempStr, setLowTempStr] = useState<string>(LOW_TEMP_STR_DEFAULT);
  const [highTempStr, setHighTempStr] = useState<string>(HIGH_TEMP_STR_DEFAULT);

  const sendPushNotification = usePushNotifications();

  // TODO: Add real check for Celsius once settings are added
  const [monitoredData] = useState({
    currentTemp: temperature,
    lowTemp: false ? LOW_TEMP_DEFAULT : LOW_TEMP_DEFAULT * (9 / 5) + 32,
    highTemp: false ? HIGH_TEMP_DEFAULT : HIGH_TEMP_DEFAULT * (9 / 5) + 32,
    isCelsius: false,
    deviceConnected: false,
  });

  useEffect(() => {
    return () => {
      // Just calling stop() isn't enough, b/c task continues running when app is reopened for some reason
      monitoredData.deviceConnected = false;
      BackgroundService.stop();
    };
  }, []);

  useEffect(() => {
    monitoredData.currentTemp = temperature;
  }, [temperature]);

  useEffect(() => {
    if (connectedDevice) monitoredData.deviceConnected = true;
    else monitoredData.deviceConnected = false;
  }, [connectedDevice]);

  // TODO: Add icon to notifications
  const monitorTemps = async () => {
    await new Promise(async () => {
      let lowNotifSent = false,
        highNotifSent = false;
      while (monitoredData && monitoredData.deviceConnected) {
        const degreeType = monitoredData.isCelsius ? `\u00b0C` : `\u00b0F`;

        BackgroundService.updateNotification({
          taskDesc: monitoredData.currentTemp + degreeType,
        });

        if (
          !lowNotifSent &&
          monitoredData.currentTemp <= monitoredData.lowTemp
        ) {
          sendPushNotification(
            "Low temperature alert",
            `Temperature below ${monitoredData.lowTemp}${degreeType}`
          );
          lowNotifSent = true;
        } else if (
          lowNotifSent &&
          monitoredData.currentTemp > monitoredData.lowTemp
        ) {
          lowNotifSent = false;
        } else if (
          !highNotifSent &&
          monitoredData.currentTemp >= monitoredData.highTemp
        ) {
          sendPushNotification(
            "High temperature alert",
            `Temperature above ${monitoredData.highTemp}${degreeType}`
          );
          highNotifSent = true;
        } else if (
          highNotifSent &&
          monitoredData.currentTemp < monitoredData.highTemp
        ) {
          highNotifSent = false;
        }
        await sleep(1000);
      }
    });
  };

  const monitorTempsOptions = {
    taskName: "Monitor Temperature",
    taskTitle: "Temperature",
    taskDesc: "Waiting for reading",
    taskIcon: {
      name: "ic_launcher",
      type: "mipmap",
    },
    color: "#ff00ff",
    linkingURI: "fiery-briquette://",
  };

  const scanForDevices = async () => {
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      scanForPeripherals();
    }
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const openModal = async () => {
    scanForDevices();
    setIsModalVisible(true);
  };

  const connect = (): void => {
    openModal();
  };

  const disconnect = (): void => {
    disconnectFromDevice();
  };

  const getCurrentTempStr = (): string => {
    if (!monitoredData.deviceConnected) return "Not Connected";
    if (monitoredData.isCelsius) return `${temperature}\u00b0C`;
    return `${temperature}\u00b0F`;
  };

  return (
    <DismissKeyboard>
      <View style={styles.container}>
        <View style={styles.body}>
          <AnimatedTempDial
            lowTemp={monitoredData.lowTemp}
            highTemp={monitoredData.highTemp}
            currentTemp={temperature}
          />
          <Text style={styles.temperature}>{getCurrentTempStr()}</Text>
          <View style={styles.tempFlagInputHolderRow}>
            <View style={styles.tempFlagInputHolderCol}>
              <TextInput
                style={[styles.tempFlagInput, styles.tempFlagInputLow]}
                keyboardType="numeric"
                value={lowTempStr}
                onFocus={() => {
                  if (lowTempStr === LOW_TEMP_STR_DEFAULT) {
                    setLowTempStr("");
                  }
                }}
                onChangeText={(text) => {
                  const temp = filterNumInput(text);
                  setLowTempStr(temp);
                }}
                onEndEditing={() => {
                  if (lowTempStr === "") setLowTempStr(LOW_TEMP_STR_DEFAULT);
                  else {
                    monitoredData.lowTemp = Number(lowTempStr);
                    if (Number(lowTempStr) >= monitoredData.highTemp) {
                      setHighTempStr(`${Number(lowTempStr) + 1}`);
                      monitoredData.highTemp = Number(lowTempStr) + 1;
                    }
                  }
                }}
              ></TextInput>
              <Pressable
                onPress={() => {
                  const lowDefault = monitoredData.isCelsius
                    ? LOW_TEMP_DEFAULT
                    : LOW_TEMP_DEFAULT * (9 / 5) + 32;

                  if (lowDefault >= monitoredData.highTemp) {
                    setHighTempStr(`${lowDefault + 1}`);
                    monitoredData.highTemp = lowDefault + 1;
                  }
                  setLowTempStr(LOW_TEMP_STR_DEFAULT);
                  monitoredData.lowTemp = lowDefault;
                }}
              >
                <Image
                  style={[
                    styles.tempFlagInputReset,
                    lowTempStr === LOW_TEMP_STR_DEFAULT || lowTempStr === ""
                      ? styles.hidden
                      : null,
                  ]}
                  source={require("@/assets/images/reset-low.png")}
                />
              </Pressable>
            </View>
            <View style={styles.tempFlagInputHolderCol}>
              <TextInput
                style={[styles.tempFlagInput, styles.tempFlagInputHigh]}
                keyboardType="numeric"
                value={highTempStr}
                onFocus={() => {
                  if (highTempStr === HIGH_TEMP_STR_DEFAULT) {
                    setHighTempStr("");
                  }
                }}
                onChangeText={(text) => {
                  const temp = filterNumInput(text);
                  setHighTempStr(temp);
                }}
                onEndEditing={() => {
                  if (highTempStr === "") setHighTempStr(HIGH_TEMP_STR_DEFAULT);
                  else {
                    monitoredData.highTemp = Number(highTempStr);
                    if (Number(highTempStr) <= monitoredData.lowTemp) {
                      setLowTempStr(`${Number(highTempStr) - 1}`);
                      monitoredData.lowTemp = Number(highTempStr) - 1;
                    }
                  }
                }}
              ></TextInput>
              <Pressable
                onPress={() => {
                  const highDefault = monitoredData.isCelsius
                    ? HIGH_TEMP_DEFAULT
                    : HIGH_TEMP_DEFAULT * (9 / 5) + 32;

                  if (highDefault <= monitoredData.lowTemp) {
                    setLowTempStr(`${highDefault - 1}`);
                    monitoredData.lowTemp = highDefault - 1;
                  }
                  setHighTempStr(HIGH_TEMP_STR_DEFAULT);
                  monitoredData.highTemp = highDefault;
                }}
              >
                <Image
                  style={[
                    styles.tempFlagInputReset,
                    highTempStr === HIGH_TEMP_STR_DEFAULT || highTempStr === ""
                      ? styles.hidden
                      : null,
                  ]}
                  source={require("../assets/images/reset-high.png")}
                />
              </Pressable>
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <View style={styles.bluetoothLabel}>
            <Text style={styles.bluetoothLabelLine}>Bluetooth</Text>
            <Text style={styles.bluetoothLabelLine}>
              Connected to:{" "}
              <Text style={styles.bluetoothLabelDevice}>
                {connectedDevice ? connectedDevice.name : " "}
              </Text>
            </Text>
          </View>
          <Pressable
            style={[
              styles.bluetoothButton,
              tryingConnection
                ? styles.bluetoothButtonConnecting
                : connectedDevice
                  ? styles.bluetoothButtonDisconnect
                  : styles.bluetoothButtonConnect,
            ]}
            onPress={() => {
              if (tryingConnection) return;
              if (connectedDevice) disconnect();
              else connect();
            }}
          >
            <Text style={styles.bluetoothButtonText}>
              {tryingConnection
                ? "Connecting..."
                : connectedDevice
                  ? "Disconnect"
                  : "Connect"}
            </Text>
          </Pressable>
        </View>
        <DeviceModal
          closeModal={hideModal}
          visible={isModalVisible}
          connectToPeripheral={async (device: Device) => {
            setTryingConnection(true);
            const success = await connectToDevice(device);
            if (!success)
              Alert.alert(
                "Connection Failed",
                "Could not connect to Bluetooth device. Please try again."
              );
            setTryingConnection(false);
            await BackgroundService.start(monitorTemps, monitorTempsOptions);
          }}
          devices={allDevices}
        />
      </View>
    </DismissKeyboard>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  footer: {
    height: 100,
    justifyContent: "space-between",
    alignItems: "center",
    flexDirection: "row",
  },
  temperature: {
    top: -50,
    fontSize: 50,
    textAlign: "center",
  },
  tempFlagInputHolderRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  tempFlagInputHolderCol: {
    flexDirection: "column",
    alignItems: "center",
  },
  tempFlagInput: {
    textAlign: "center",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderColor: "black",
    borderWidth: 3,
    fontSize: 20,
    fontWeight: "bold",
  },
  tempFlagInputLow: { backgroundColor: "lightblue" },
  tempFlagInputHigh: { backgroundColor: "pink" },
  bluetoothLabel: {
    flexDirection: "column",
    margin: "2.5%",
    width: "60%",
  },
  tempFlagInputReset: {
    width: 25,
    height: 25,
    margin: 10,
    resizeMode: "contain",
  },
  bluetoothLabelLine: {
    fontSize: 20,
  },
  bluetoothLabelDevice: {
    fontStyle: "italic",
    fontWeight: "bold",
  },
  bluetoothButton: {
    margin: "2.5%",
    textAlign: "center",
    width: "30%",
    height: 50,
    borderColor: "black",
    borderWidth: 3,
    justifyContent: "center",
  },
  bluetoothButtonConnect: {
    backgroundColor: "black",
  },
  bluetoothButtonDisconnect: { backgroundColor: "red" },
  bluetoothButtonConnecting: {
    backgroundColor: "gray",
  },
  bluetoothButtonText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
