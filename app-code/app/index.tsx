import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { Device } from "react-native-ble-plx";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import BackgroundService from "react-native-background-actions";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [lowTempStr, setLowTempStr] = useState<string>(LOW_TEMP_STR_DEFAULT);
  const [highTempStr, setHighTempStr] = useState<string>(HIGH_TEMP_STR_DEFAULT);

  const [lowTempDefault, setLowTempDefault] = useState<number>(0);
  const [highTempDefault, setHighTempDefault] = useState<number>(1);

  const sendPushNotification = usePushNotifications();

  interface dataTypes {
    currentTemp: number;
    lowTemp: number;
    highTemp: number;
    isCelsius: boolean;
    deviceConnected: boolean;
    rollingTempList: number[];
  }

  // TODO: Add real check for Celsius once settings are added
  const [monitoredData] = useState<dataTypes>({
    currentTemp: temperature,
    lowTemp: 0,
    highTemp: 1,
    isCelsius: true,
    deviceConnected: false,
    rollingTempList: [],
  });

  useEffect(() => {
    return () => {
      // Just calling stop() isn't enough, b/c task continues running when app is reopened for some reason
      monitoredData.deviceConnected = false;
      BackgroundService.stop();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        try {
          const newIsCelsius = await AsyncStorage.getItem("is-celsius");
          // AsyncStorage stores strings only
          if (newIsCelsius) {
            monitoredData.isCelsius = newIsCelsius === "true";
          } else {
            monitoredData.isCelsius = true;
            try {
              AsyncStorage.setItem("is-celsius", "true");
            } catch (e) {
              console.log(
                "Error saving default settings data (degree type): ",
                e
              );
            }
          }

          const newLow = await AsyncStorage.getItem("low-temp-default");
          if (newLow) {
            monitoredData.lowTemp = parseInt(newLow);
          } else {
            monitoredData.lowTemp = monitoredData.isCelsius ? 40 : 100;
            try {
              AsyncStorage.setItem(
                "low-temp-default",
                monitoredData.lowTemp.toString()
              );
            } catch (e) {
              console.log(
                "Error saving default settings data (low default): ",
                e
              );
            }
          }
          monitoredData.highTemp = monitoredData.lowTemp + 1; // Needed to prevent temp dial from trying to render w/ invalid range
          setLowTempDefault(monitoredData.lowTemp);

          const newHigh = await AsyncStorage.getItem("high-temp-default");
          if (newHigh) {
            monitoredData.highTemp = parseInt(newHigh);
          } else {
            monitoredData.highTemp = monitoredData.isCelsius ? 150 : 300;
            try {
              AsyncStorage.setItem(
                "high-temp-default",
                monitoredData.highTemp.toString()
              );
            } catch (e) {
              console.log(
                "Error saving default settings data (high default): ",
                e
              );
            }
          }
          setHighTempDefault(monitoredData.highTemp);
        } catch (e) {
          console.log("Error reading settings data", e);
        }
      };

      loadSettings();
    }, [])
  );

  useEffect(() => {
    const newLen = monitoredData.rollingTempList.push(temperature);
    if (newLen > 10) monitoredData.rollingTempList.shift();
    monitoredData.currentTemp =
      monitoredData.rollingTempList.reduce(
        (total: number, current: number) => (total += current),
        0
      ) / monitoredData.rollingTempList.length;

    if (!monitoredData.isCelsius) {
      monitoredData.currentTemp = monitoredData.currentTemp * (9 / 5) + 32;
    }
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
          taskDesc: getCurrentTempStr(),
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

    if (!connectedDevice) return "Not Connected";
    const roundedTemp = monitoredData.currentTemp.toFixed(1);
    if (monitoredData.isCelsius) return `${roundedTemp}\u00b0C`;
    return `${roundedTemp}\u00b0F`;
  };

  return (
    <DismissKeyboard>
      <View style={styles.container}>
        <View style={styles.body}>
          <Link style={styles.settingsButton} href={"/settings"} asChild>
            <Pressable>
              <Ionicons name="settings-outline" color="#000000" size={50} />
            </Pressable>
          </Link>
          <AnimatedTempDial
            lowTemp={monitoredData.lowTemp}
            highTemp={monitoredData.highTemp}
            currentTemp={
              connectedDevice
                ? monitoredData.currentTemp
                : (monitoredData.lowTemp + monitoredData.highTemp) / 2
            }
          />
          <View style={styles.temperatureHolder}>
            <Text
              style={[
                styles.temperature,
                connectedDevice ? null : styles.temperatureNotConnected,
              ]}
            >
              {getCurrentTempStr()}
            </Text>
          </View>
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
                  if (lowTempDefault >= monitoredData.highTemp) {
                    setHighTempStr(`${lowTempDefault + 1}`);
                    monitoredData.highTemp = lowTempDefault + 1;
                  }
                  setLowTempStr(LOW_TEMP_STR_DEFAULT);
                  monitoredData.lowTemp = lowTempDefault;
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
                  if (highTempDefault <= monitoredData.lowTemp) {
                    setLowTempStr(`${highTempDefault - 1}`);
                    monitoredData.lowTemp = highTempDefault - 1;
                  }
                  setHighTempStr(HIGH_TEMP_STR_DEFAULT);
                  monitoredData.highTemp = highTempDefault;
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
  temperatureHolder: {
    alignItems: "center",
  },
  temperature: {
    top: -50,
    fontSize: 50,
    textAlign: "center",
    width: 325,
  },
  temperatureNotConnected: {
    fontSize: 45,
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
  settingsButton: {
    position: "absolute",
    right: 20,
    top: 20,
  },
});
