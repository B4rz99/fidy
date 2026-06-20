import { Text, View } from "@/shared/components/rn";

type ListDateHeaderProps = {
  readonly label: string;
  readonly variant?: "section" | "plain";
};

export function ListDateHeader({ label, variant = "section" }: ListDateHeaderProps) {
  return (
    <View className="px-4 pb-2 pt-4">
      <Text
        className={
          variant === "plain"
            ? "font-poppins-semibold text-caption text-primary dark:text-primary-dark"
            : "font-poppins-semibold text-caption uppercase tracking-widest text-secondary dark:text-secondary-dark"
        }
      >
        {label}
      </Text>
    </View>
  );
}

export type { ListDateHeaderProps };
