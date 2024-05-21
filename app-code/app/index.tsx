import { Text, View, StyleSheet, Button } from "react-native";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text>Index</Text>
      </View>
      <View style={styles.footer}>
        <Text>Button label</Text>
        <Button title="Button" onPress={() => router.navigate("/bluetooth")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
});
