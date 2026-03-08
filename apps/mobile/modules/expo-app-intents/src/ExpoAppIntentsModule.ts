import { requireNativeModule } from "expo";

export type ExpoAppIntentsModule = {
  isAvailable: () => boolean;
  addListener: (eventName: string, listener: (...args: never[]) => void) => { remove: () => void };
};

// Lazy getter — defers requireNativeModule until first use so importing this
// file on Android does not crash before isAvailable() is checked.
let _module: ExpoAppIntentsModule | null = null;

const ExpoAppIntentsProxy = new Proxy({} as ExpoAppIntentsModule, {
  get(_target, prop: string) {
    if (!_module) {
      _module = requireNativeModule<ExpoAppIntentsModule>("ExpoAppIntents");
    }
    return _module[prop as keyof ExpoAppIntentsModule];
  },
});

export default ExpoAppIntentsProxy;
