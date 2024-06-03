import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { Animated, Image } from "react-native";

export default function AnimatedTempDial({
  lowTemp,
  highTemp,
  currentTemp,
}: {
  lowTemp: number;
  highTemp: number;
  currentTemp: number;
}): React.ReactNode {
  const extraTo90 = ((highTemp - lowTemp) / 140) * 20;
  const lowMax = lowTemp - extraTo90;
  const highMax = highTemp + extraTo90;

  const [rotation] = useState(new Animated.Value(currentTemp));

  useEffect(() => {
    rotateImage(currentTemp);
  }, [currentTemp]);

  const rotateImage = (degree: number) => {
    if (degree < lowMax) degree = lowMax;
    else if (degree > highMax) degree = highMax;
    Animated.timing(rotation, {
      toValue: degree,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const rotateInterpolate = rotation.interpolate({
    inputRange: [lowTemp, highTemp],
    outputRange: ["-70deg", "70deg"],
  });

  return (
    <View style={styles.dialContainer}>
      <Image
        source={require("@/assets/images/temp-dial.png")}
        style={styles.dial}
      />
      <Animated.Image
        source={require("@/assets/images/temp-indicator.png")}
        style={[
          styles.indicator,
          { transform: [{ rotate: rotateInterpolate }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dialContainer: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  dial: {
    width: 400,
    height: 400,
    top: 200,
  },
  indicator: {
    width: 400,
    height: 400,
    top: 200,
    position: "absolute",
  },
});
