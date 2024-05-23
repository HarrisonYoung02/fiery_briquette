import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef, useEffect } from "react";
import DismissKeyboard from "@/components/DismissKeyboard";
import AnimatedTempDial from "@/components/AnimatedTempDial";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const filterNumInput = (numStr: string): string =>
  numStr.toString().replace(/[^0-9]/g, "");

export default function Index(): React.ReactNode {
  const router = useRouter();
  const [connected, setConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>("");

  const LOW_TEMP_STR_DEFAULT = "Set Low";
  const HIGH_TEMP_STR_DEFAULT = "Set High";
  const LOW_TEMP_DEFAULT = 40; // Defaults in Celsius
  const HIGH_TEMP_DEFAULT = 150;
  const [isCelsius, setIsCelsius] = useState<boolean>(false);
  const [currentTemp, setCurrentTemp] = useState<number>(0);
  const [lowTemp, setLowTemp] = useState<number>(
    isCelsius ? LOW_TEMP_DEFAULT : LOW_TEMP_DEFAULT * (9 / 5) + 32
  );
  const [highTemp, setHighTemp] = useState<number>(
    isCelsius ? HIGH_TEMP_DEFAULT : HIGH_TEMP_DEFAULT * (9 / 5) + 32
  );
  const [lowTempStr, setLowTempStr] = useState<string>(LOW_TEMP_STR_DEFAULT);
  const [highTempStr, setHighTempStr] = useState<string>(HIGH_TEMP_STR_DEFAULT);

  const sendPushNotification = usePushNotifications();
  const lowNotifSent = useRef<boolean>(false);
  const highNotifSent = useRef<boolean>(false);

  useEffect(() => {
    const monitorTemps = () => {
      const degreeType = isCelsius ? `\u00b0C` : `\u00b0F`;

      if (!lowNotifSent.current && currentTemp <= lowTemp) {
        sendPushNotification(
          "Low temperature alert",
          `Temperature below ${lowTemp}${degreeType}`
        );
        lowNotifSent.current = true;
      } else if (lowNotifSent.current && currentTemp > lowTemp) {
        lowNotifSent.current = false;
      } else if (!highNotifSent.current && currentTemp >= highTemp) {
        sendPushNotification(
          "High temperature alert",
          `Temperature above ${highTemp}${degreeType}`
        );
        highNotifSent.current = true;
      } else if (highNotifSent.current && currentTemp < highTemp) {
        highNotifSent.current = false;
      }
    };

    if (connected) monitorTemps();
  }, [currentTemp, lowTemp, highTemp]);

  const [countUp, setCountUp] = useState<boolean>(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const increment = () => {
    if (connected) {
      let temp = currentTemp;
      if (countUp) temp += 10;
      else temp -= 10;
      setCurrentTemp(temp);
      if (temp <= lowTemp - 50) setCountUp(true);
      else if (temp >= highTemp + 50) setCountUp(false);
    }
  };
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(increment, 1000);
  }, [connected, currentTemp, lowTemp, highTemp, countUp]);

  // TODO: replace/update when bluetooth added
  const connect = (): void => {
    router.navigate("/bluetooth");
    setConnected(true);
    setDeviceName("Example device");
    setCurrentTemp(200);
  };
  const disconnect = (): void => {
    setConnected(false);
    setDeviceName("");
  };

  const getCurrentTempStr = (): string => {
    if (!connected) return "Not Connected";
    if (isCelsius) return `${currentTemp}\u00b0C`;
    return `${currentTemp}\u00b0F`;
  };

  return (
    <DismissKeyboard>
      <View style={styles.container}>
        <View style={styles.body}>
          <AnimatedTempDial
            lowTemp={lowTemp}
            highTemp={highTemp}
            currentTemp={currentTemp}
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
                    setLowTemp(Number(lowTempStr));
                    if (Number(lowTempStr) >= highTemp) {
                      setHighTempStr(`${Number(lowTempStr) + 1}`);
                      setHighTemp(Number(lowTempStr) + 1);
                    }
                  }
                }}
              ></TextInput>
              <Pressable
                onPress={() => {
                  const lowDefault = isCelsius
                    ? LOW_TEMP_DEFAULT
                    : LOW_TEMP_DEFAULT * (9 / 5) + 32;

                  if (lowDefault >= highTemp) {
                    setHighTempStr(`${lowDefault + 1}`);
                    setHighTemp(lowDefault + 1);
                  }
                  setLowTempStr(LOW_TEMP_STR_DEFAULT);
                  setLowTemp(lowDefault);
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
                    setHighTemp(Number(highTempStr));
                    if (Number(highTempStr) <= lowTemp) {
                      setLowTempStr(`${Number(highTempStr) - 1}`);
                      setLowTemp(Number(highTempStr) - 1);
                    }
                  }
                }}
              ></TextInput>
              <Pressable
                onPress={() => {
                  const highDefault = isCelsius
                    ? HIGH_TEMP_DEFAULT
                    : HIGH_TEMP_DEFAULT * (9 / 5) + 32;

                  if (highDefault <= lowTemp) {
                    setLowTempStr(`${highDefault - 1}`);
                    setLowTemp(highDefault - 1);
                  }
                  setHighTempStr(HIGH_TEMP_STR_DEFAULT);
                  setHighTemp(highDefault);
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
              <Text style={styles.bluetoothLabelDevice}>{deviceName}</Text>
            </Text>
          </View>
          <Pressable
            style={[
              styles.bluetoothButton,
              connected
                ? styles.bluetoothButtonDisconnect
                : styles.bluetoothButtonConnect,
            ]}
            onPress={() => {
              if (connected) disconnect();
              else connect();
            }}
          >
            <Text style={styles.bluetoothButtonText}>
              {connected ? "Disconnect" : "Connect"}
            </Text>
          </Pressable>
        </View>
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
    margin: 10,
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
    margin: 10,
    textAlign: "center",
    width: 125,
    height: 50,
    borderColor: "black",
    borderWidth: 3,
    justifyContent: "center",
  },
  bluetoothButtonConnect: {
    backgroundColor: "black",
  },
  bluetoothButtonDisconnect: { backgroundColor: "red" },
  bluetoothButtonText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
