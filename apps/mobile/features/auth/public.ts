import { requireUserId } from "@/shared/types/assertions";
import { useAuthStore } from "./store";

export const useAccountCreatedAt = () => useAuthStore((s) => s.session?.user.created_at ?? "");

export const useOptionalUserId = () => {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return userId == null ? null : requireUserId(userId);
};
