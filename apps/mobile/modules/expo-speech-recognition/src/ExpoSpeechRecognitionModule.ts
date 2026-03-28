import { requireNativeModule } from "expo";

export type ExpoSpeechRecognitionModuleType = {
  isAvailable: () => boolean;
  startListening: (locale: string) => void;
  stopListening: () => void;
  addListener: (eventName: string, listener: (...args: never[]) => void) => { remove: () => void };
};

let _module: ExpoSpeechRecognitionModuleType | null = null;

const ExpoSpeechRecognitionProxy = new Proxy({} as ExpoSpeechRecognitionModuleType, {
  get(_target, prop: string) {
    if (!_module) {
      _module = requireNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");
    }
    return _module[prop as keyof ExpoSpeechRecognitionModuleType];
  },
});

export default ExpoSpeechRecognitionProxy;
