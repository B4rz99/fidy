import { useRouter } from "expo-router";
import { MemoryManager } from "@/features/ai-chat";
import { useMountEffect } from "@/shared/hooks";
import { trackAiMemoryViewed } from "@/shared/lib";

export default function AiMemoriesScreen() {
  const { back } = useRouter();
  useMountEffect(() => trackAiMemoryViewed());
  return <MemoryManager onBack={back} />;
}
