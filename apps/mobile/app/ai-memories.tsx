import { useRouter } from "expo-router";
import { MemoryManager } from "@/features/ai-chat";

export default function AiMemoriesScreen() {
  const { back } = useRouter();
  return <MemoryManager onBack={back} />;
}
