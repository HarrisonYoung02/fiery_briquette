import { StyleSheet, View, Text, Pressable, TextInput } from "react-native";
import { Link } from "expo-router";
import { Entypo } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DismissKeyboard from "@/components/DismissKeyboard";

const filterNumInput = (numStr: string): string =>
  numStr.toString().replace(/[^0-9]/g, "");

export default function Settings(): React.ReactNode {
  const [lowDefaultBase, setLowDefaultBase] = useState<number>(0);
  const [highDefaultBase, setHighDefaultBase] = useState<number>(0);
  const [lowDefaultUser, setLowDefaultUser] = useState<string>("");
  const [highDefaultUser, setHighDefaultUser] = useState<string>("");
  const [isCelsius, setisCelsius] = useState<boolean>(false);

  useEffect(() => {
    try {
      AsyncStorage.getItem("low-temp-default").then((newLow) => {
        if (newLow) {
          setLowDefaultBase(parseInt(newLow));
          setLowDefaultUser(newLow);
        }
      });

      AsyncStorage.getItem("high-temp-default").then((newHigh) => {
        if (newHigh) {
          setHighDefaultBase(parseInt(newHigh));
          setHighDefaultUser(newHigh);
        }
      });

      AsyncStorage.getItem("is-celsius").then((newIsCelsius) => {
        if (newIsCelsius) setisCelsius(newIsCelsius === "true");
      });
    } catch (e) {
      console.log("Error reading settings data: ", e);
    }
  }, []);

  const saveData = async (itemName: string, newVal: string) => {
    try {
      AsyncStorage.setItem(itemName, newVal);
    } catch (e) {
      console.log(`Error saving settings data (${itemName}): `, e);
    }
  };

  return (
    <DismissKeyboard>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <View style={[styles.setting, styles.row]}>
          <View style={styles.cell2}>
            <View style={[styles.cell1, styles.row]}>
              <Text style={[styles.settingLabel, styles.cell1]}>
                Degree type:
              </Text>
              <Pressable
                style={[styles.settingItem, styles.button, styles.cell1]}
                onPress={() => {
                  const newIsCelsius = !isCelsius;
                  setisCelsius(newIsCelsius);
                  saveData("is-celsius", newIsCelsius ? "true" : "false");
                }}
              >
                <Text style={[styles.centerText]}>
                  {isCelsius ? `Celsius` : `Fahrenheit`}
                </Text>
              </Pressable>
            </View>
          </View>
          <Text style={[styles.settingDesc, styles.cell2]}></Text>
        </View>

        <View style={[styles.setting, styles.row]}>
          <View style={styles.cell2}>
            <View style={[styles.cell1, styles.row]}>
              <Text style={[styles.settingLabel, styles.cell1]}>
                Default low:
              </Text>
              <TextInput
                style={[
                  styles.settingItem,
                  styles.textEntry,
                  styles.cell1,
                  styles.centerText,
                ]}
                keyboardType="numeric"
                value={lowDefaultUser}
                onChangeText={(text) => {
                  const temp = filterNumInput(text);
                  setLowDefaultUser(temp);
                }}
                onEndEditing={() => {
                  if (lowDefaultUser === "") {
                    setLowDefaultUser(lowDefaultBase.toString());
                  } else {
                    setLowDefaultBase(parseInt(lowDefaultUser));
                    saveData("low-temp-default", lowDefaultUser);

                    if (parseInt(lowDefaultUser) >= highDefaultBase) {
                      const newHigh = parseInt(lowDefaultUser) + 1;
                      setHighDefaultBase(newHigh);
                      setHighDefaultUser(newHigh.toString());
                      saveData("high-temp-default", newHigh.toString());
                    }
                  }
                }}
              />
            </View>
            <View style={[styles.cell1, styles.row]}>
              <Text style={[styles.settingLabel, styles.cell1]}>
                Default high:
              </Text>
              <TextInput
                style={[
                  styles.settingItem,
                  styles.textEntry,
                  styles.cell1,
                  styles.centerText,
                ]}
                keyboardType="numeric"
                value={highDefaultUser}
                onChangeText={(text) => {
                  const temp = filterNumInput(text);
                  setHighDefaultUser(temp);
                }}
                onEndEditing={() => {
                  if (highDefaultUser === "") {
                    setHighDefaultUser(highDefaultBase.toString());
                  } else {
                    setHighDefaultBase(parseInt(highDefaultUser));
                    saveData("high-temp-default", highDefaultUser);

                    if (parseInt(highDefaultUser) <= lowDefaultBase) {
                      const newLow = parseInt(highDefaultUser) - 1;
                      setLowDefaultBase(newLow);
                      setLowDefaultUser(newLow.toString());
                      saveData("low-temp-default", newLow.toString());
                    }
                  }
                }}
              />
            </View>
          </View>
          <Text style={[styles.settingDesc, styles.cell2]}>
            The default temperature warning thresholds when not set.
          </Text>
        </View>

        <Link style={styles.backButton} href={"/"} asChild>
          <Pressable>
            <Entypo name="arrow-with-circle-left" color="#000000" size={50} />
          </Pressable>
        </Link>
      </View>
    </DismissKeyboard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 20,
  },
  title: {
    fontWeight: "bold",
    fontSize: 50,
    textAlign: "center",
    margin: 20,
  },
  cell1: { flex: 1 },
  cell2: { flex: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 100,
  },
  setting: {
    margin: 5,
  },
  settingLabel: {
    fontWeight: "bold",
    margin: 5,
  },
  settingItem: {
    margin: 5,
  },
  settingDesc: {
    fontStyle: "italic",
    margin: 5,
  },
  button: {
    padding: 5,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "lightgray",
  },
  textEntry: { borderBottomColor: "black", borderBottomWidth: 1 },
  centerText: {
    textAlign: "center",
  },
});
