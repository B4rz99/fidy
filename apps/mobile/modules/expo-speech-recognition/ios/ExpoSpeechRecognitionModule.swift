import ExpoModulesCore
import Speech
import AVFoundation

public class ExpoSpeechRecognitionModule: Module {
  private var speechRecognizer: SFSpeechRecognizer?
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()

  public func definition() -> ModuleDefinition {
    Name("ExpoSpeechRecognition")

    Events("onTranscript", "onError")

    Function("isAvailable") { () -> Bool in
      return SFSpeechRecognizer()?.isAvailable ?? false
    }

    Function("startListening") { (locale: String) in
      self.startRecognition(locale: locale)
    }

    Function("stopListening") {
      self.stopRecognition()
    }
  }

  private func startRecognition(locale: String) {
    // Stop any existing session
    stopRecognition()

    let recognizerLocale = Locale(identifier: locale)
    speechRecognizer = SFSpeechRecognizer(locale: recognizerLocale)

    guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
      sendEvent("onError", ["message": "Speech recognizer not available for locale: \(locale)"])
      return
    }

    SFSpeechRecognizer.requestAuthorization { [weak self] status in
      guard let self = self else { return }
      DispatchQueue.main.async {
        switch status {
        case .authorized:
          self.beginAudioSession()
        case .denied:
          self.sendEvent("onError", ["message": "Speech recognition permission denied"])
        case .restricted:
          self.sendEvent("onError", ["message": "Speech recognition restricted on this device"])
        case .notDetermined:
          self.sendEvent("onError", ["message": "Speech recognition not determined"])
        @unknown default:
          self.sendEvent("onError", ["message": "Unknown authorization status"])
        }
      }
    }
  }

  private func beginAudioSession() {
    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    guard let recognitionRequest = recognitionRequest else {
      sendEvent("onError", ["message": "Failed to create recognition request"])
      return
    }

    recognitionRequest.shouldReportPartialResults = true

    let inputNode = audioEngine.inputNode

    recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self = self else { return }

      if let result = result {
        let text = result.bestTranscription.formattedString
        let isFinal = result.isFinal
        self.sendEvent("onTranscript", ["text": text, "isFinal": isFinal])

        if isFinal {
          self.stopRecognition()
        }
      }

      if let error = error {
        self.sendEvent("onError", ["message": error.localizedDescription])
        self.stopRecognition()
      }
    }

    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
      recognitionRequest.append(buffer)
    }

    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
      try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
      try audioEngine.start()
    } catch {
      sendEvent("onError", ["message": "Audio engine failed to start: \(error.localizedDescription)"])
      stopRecognition()
    }
  }

  private func stopRecognition() {
    audioEngine.stop()
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    recognitionRequest = nil
    recognitionTask = nil
  }
}
