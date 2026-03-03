import { Target } from "lucide-react-native";
import { ComingSoonScreen } from "@/shared/components/ComingSoonScreen";

export default function GoalsTab() {
  return (
    <ComingSoonScreen
      Icon={Target}
      headerTitle="Goals"
      headline="Goals are on their way"
      description="Set savings targets, track your progress, and reach your financial goals"
    />
  );
}
