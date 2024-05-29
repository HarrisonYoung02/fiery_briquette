import { useState } from "react";
import { StyleSheet, Text, View, Button } from "react-native";
import BackgroundService from "react-native-background-actions";

const sleep = (time: any) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), time));

// You can do anything in your task such as network requests, timers and so on,
// as long as it doesn't touch UI. Once your task completes (i.e. the promise is resolved),
// React Native will go into "paused" mode (unless there are other tasks running,
// or there is a foreground app).
const veryIntensiveTask = async (taskDataArguments: any) => {
  // Example of an infinite loop task
  const { delay } = taskDataArguments;
  await new Promise(async (resolve) => {
    for (let i = 0; BackgroundService.isRunning(); i++) {
      console.log(i);
      await sleep(delay);
    }
  });
};

const options = {
  taskName: "Example",
  taskTitle: "ExampleTask title",
  taskDesc: "ExampleTask description",
  taskIcon: {
    name: "ic_launcher",
    type: "mipmap",
  },
  color: "#ff00ff",
  linkingURI: "yourSchemeHere://chat/jane", // See Deep Linking for more info
  parameters: {
    delay: 1000,
  },
};

export default function BackgroundFetchScreen() {
  const [isRunning, setIsRunning] = useState(false);

  const toggleFetchTask = async () => {
    if (isRunning) {
      await BackgroundService.stop();
      setIsRunning(false);
    } else {
      await BackgroundService.start(veryIntensiveTask, options);
      await BackgroundService.updateNotification({
        taskDesc: "New ExampleTask description",
      });
      setIsRunning(true);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.textContainer}></View>
      <Button
        title={isRunning ? "Stop task" : "Start task"}
        onPress={toggleFetchTask}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    margin: 10,
  },
  boldText: {
    fontWeight: "bold",
  },
});
