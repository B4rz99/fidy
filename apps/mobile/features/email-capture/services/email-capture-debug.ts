export const isEmailCaptureDebugEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_EMAIL_CAPTURE_DEBUG === "1";
