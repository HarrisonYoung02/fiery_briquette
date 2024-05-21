import {
  Text,
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef, useEffect } from "react";

const DismissKeyboard = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => (
  <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
    {children}
  </TouchableWithoutFeedback>
);

const filterNumInput = (numStr: string): string =>
  numStr.toString().replace(/[^0-9]/g, "");

const disconnect = () => {}; // TODO: replace/update when bluetooth added

export default function Index(): React.ReactNode {
  const LOW_TEMP_STR_DEFAULT = "Set Low";
  const HIGH_TEMP_STR_DEFAULT = "Set High";
  const LOW_TEMP_DEFAULT = 100; // Temps in F
  const HIGH_TEMP_DEFAULT = 300;

  const router = useRouter();
  const [connected, setConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>("");
  const [currentTempStr, setCurrentTempStr] = useState<string>("Not Connected");
  const [lowTempStr, setLowTempStr] = useState<string>(LOW_TEMP_STR_DEFAULT);
  const [highTempStr, setHighTempStr] = useState<string>(HIGH_TEMP_STR_DEFAULT);

  const [countUp, setCountUp] = useState<boolean>(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const increment = () => {
    if (connected) {
      if (currentTempStr === "Not Connected") setCurrentTempStr("200");
      else {
        let temp = Number(currentTempStr);
        if (countUp) temp += 10;
        else temp -= 10;
        setCurrentTempStr(temp.toString());
        const lowTemp =
          lowTempStr === LOW_TEMP_STR_DEFAULT
            ? LOW_TEMP_DEFAULT
            : Number(lowTempStr);
        const highTemp =
          highTempStr === HIGH_TEMP_STR_DEFAULT
            ? HIGH_TEMP_DEFAULT
            : Number(highTempStr);
        console.log(`Current: ${temp}, Low: ${lowTemp}, High: ${highTemp}`);
        if (temp <= lowTemp || temp >= highTemp) {
          setCountUp(!countUp);
        }
      }
    }
  };
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(increment, 1000);
  }, [connected, currentTempStr, lowTempStr, highTempStr, countUp]);

  return (
    <DismissKeyboard>
      <View style={styles.container}>
        <View style={styles.body}>
          <Text style={styles.temperature}>{currentTempStr}</Text>
          <View style={styles.tempFlagInputHolder}>
            <TextInput
              style={[styles.tempFlagInput, styles.tempFlagInputLow]}
              keyboardType="numeric"
              value={lowTempStr}
              onFocus={() => {
                if (lowTempStr === LOW_TEMP_STR_DEFAULT) {
                  setLowTempStr("");
                }
              }}
              onChangeText={(text) => setLowTempStr(filterNumInput(text))}
              onEndEditing={() => {
                if (lowTempStr === "") setLowTempStr(LOW_TEMP_STR_DEFAULT);
              }}
            ></TextInput>
            <TextInput
              style={[styles.tempFlagInput, styles.tempFlagInputHigh]}
              keyboardType="numeric"
              value={highTempStr}
              onFocus={() => {
                if (highTempStr === HIGH_TEMP_STR_DEFAULT) {
                  setHighTempStr("");
                }
              }}
              onChangeText={(text) => setHighTempStr(filterNumInput(text))}
              onEndEditing={() => {
                if (highTempStr === "") setHighTempStr(HIGH_TEMP_STR_DEFAULT);
              }}
            ></TextInput>
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
              else router.navigate("/bluetooth");
              setConnected(!connected); // TODO: remove when bluetooth added
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
    fontSize: 50,
    textAlign: "center",
  },
  tempFlagInputHolder: {
    flexDirection: "row",
    justifyContent: "space-evenly",
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
