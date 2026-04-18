import { useAuthStore } from "./store";

export const useAccountCreatedAt = () => useAuthStore((s) => s.session?.user.created_at ?? "");
