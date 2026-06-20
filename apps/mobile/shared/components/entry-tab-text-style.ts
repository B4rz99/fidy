export function getEntryTabTextStyle(input: {
  readonly isActive: boolean;
  readonly primary: string;
  readonly tertiary: string;
}) {
  return {
    color: input.isActive ? input.primary : input.tertiary,
    fontWeight: input.isActive ? "700" : "600",
    opacity: input.isActive ? 1 : 0.4,
  } as const;
}
