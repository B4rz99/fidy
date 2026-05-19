import Ionicons from "@expo/vector-icons/Ionicons";

interface AppleIconProps {
  color?: string;
}

export function AppleIcon({ color = "#FFFFFF" }: AppleIconProps) {
  return <Ionicons name="logo-apple" size={20} color={color} />;
}
