import Ionicons from "@react-native-vector-icons/ionicons";

interface AppleIconProps {
  color?: string;
}

export function AppleIcon({ color = "#FFFFFF" }: AppleIconProps) {
  return <Ionicons name="logo-apple" size={20} color={color} />;
}
