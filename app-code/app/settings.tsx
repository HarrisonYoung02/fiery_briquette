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
      <View>
        <Link style={styles.backButton} href={"/"} asChild>
          <Pressable>
            <Entypo name="arrow-with-circle-left" color="#000000" size={50} />
          </Pressable>
        </Link>
        <Text>
          These temperatures are what the high and low temperature warnings
          default to when not otherwise set.
        </Text>
        <View style={styles.dataRow}>
          <Text>Default low: </Text>
          <TextInput
            // style={}
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
              }
            }}
          />
        </View>
        <View style={styles.dataRow}>
          <Text>Default high:</Text>
          <TextInput
            // style={}
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
              }
            }}
          />
        </View>
        <View style={styles.dataRow}>
          <Text>Degree type: </Text>
          <Pressable
            onPress={() => {
              const newIsCelsius = !isCelsius;
              setisCelsius(newIsCelsius);
              saveData("is-celsius", newIsCelsius ? "true" : "false");
            }}
          >
            <Text>{isCelsius ? `Celsius` : `Fahrenheit`}</Text>
          </Pressable>
        </View>
      </View>
    </DismissKeyboard>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 10,
  },
  dataRow: {
    flexDirection: "row",
  },
});
