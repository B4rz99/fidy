import { MessageSquare, Smartphone } from "lucide-react-native";
import { Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useCaptureSourcesStore } from "../store";

const APPLE_PAY_STEPS = [
  "Abre la app Atajos en tu iPhone",
  "Toca Automatizacion > + > Transaccion",
  "Selecciona tu tarjeta y toca Siguiente",
  "Busca 'Fidy' > 'Registrar transaccion' > Activa 'Ejecutar inmediatamente'",
] as const;

const SMS_STEPS = [
  "Abre la app Atajos en tu iPhone",
  "Toca Automatizacion > + > Mensaje",
  "Selecciona los numeros de tu banco y toca Siguiente",
  "Busca 'Fidy' > 'Detectar SMS bancario' > Activa 'Ejecutar inmediatamente'",
] as const;

const StepList = ({ steps }: { steps: readonly string[] }) => {
  const stepBgColor = useThemeColor("peachLight");
  const stepTextColor = useThemeColor("accentRed");

  return (
    <View style={{ gap: 10 }}>
      {steps.map((text, index) => (
        <View key={text} className="flex-row items-start" style={{ gap: 10 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: stepBgColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="font-poppins-bold text-caption" style={{ color: stepTextColor }}>
              {index + 1}
            </Text>
          </View>
          <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark flex-1 leading-relaxed">
            {text}
          </Text>
        </View>
      ))}
    </View>
  );
};

export const ApplePaySetupCard = () => {
  const isApplePaySetupComplete = useCaptureSourcesStore((s) => s.isApplePaySetupComplete);

  const phoneIconColor = useThemeColor("accentRed");
  const smsIconColor = useThemeColor("accentGreen");
  const connectedBg = useThemeColor("accentGreenLight");
  const connectedText = useThemeColor("accentGreen");
  const disconnectedBg = useThemeColor("peachLight");
  const disconnectedText = useThemeColor("accentRed");

  return (
    <View style={{ gap: 16 }}>
      {/* Apple Pay Capture */}
      <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Smartphone size={22} color={phoneIconColor} />
            <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
              Apple Pay Capture
            </Text>
          </View>

          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: isApplePaySetupComplete ? connectedBg : disconnectedBg,
            }}
          >
            <Text
              className="font-poppins-semibold text-caption"
              style={{
                color: isApplePaySetupComplete ? connectedText : disconnectedText,
              }}
            >
              {isApplePaySetupComplete ? "Connected" : "Not set up"}
            </Text>
          </View>
        </View>

        <StepList steps={APPLE_PAY_STEPS} />
      </View>

      {/* SMS Detection */}
      <View className="rounded-chart bg-card p-5 dark:bg-card-dark" style={{ gap: 14 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <MessageSquare size={22} color={smsIconColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            Deteccion de SMS bancarios
          </Text>
        </View>

        <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
          Detecta cuando recibes SMS de tu banco para recordarte registrar la transaccion.
        </Text>

        <StepList steps={SMS_STEPS} />
      </View>
    </View>
  );
};
