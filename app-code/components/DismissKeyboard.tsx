import { TouchableWithoutFeedback, Keyboard } from "react-native";

export default function DismissKeyboard({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      {children}
    </TouchableWithoutFeedback>
  );
}
