import { Sparkles } from "lucide-react-native";
import { ComingSoonScreen } from "@/shared/components/ComingSoonScreen";

export default function AiTab() {
  return (
    <ComingSoonScreen
      Icon={Sparkles}
      headerTitle="AI Advisor"
      headline="Your AI Advisor is on its way"
      description="Smart insights about your spending, budgets, and savings — powered by AI"
    />
  );
}
