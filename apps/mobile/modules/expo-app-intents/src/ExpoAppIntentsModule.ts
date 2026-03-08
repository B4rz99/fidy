import { requireNativeModule } from "expo";

// Lazy getter — defers requireNativeModule until first use so importing this
// file on Android does not crash before isAvailable() is checked.
let _module: ReturnType<typeof requireNativeModule> | null = null;

const ExpoAppIntentsModule = new Proxy({} as ReturnType<typeof requireNativeModule>, {
  get(_target, prop) {
    if (!_module) {
      _module = requireNativeModule("ExpoAppIntents");
    }
    return (_module as Record<string | symbol, unknown>)[prop];
  },
});

export default ExpoAppIntentsModule;
