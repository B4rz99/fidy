package expo.modules.speechrecognition

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSpeechRecognitionModule : Module() {
  private var speechRecognizer: SpeechRecognizer? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoSpeechRecognition")

    Events("onTranscript", "onError")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      SpeechRecognizer.isRecognitionAvailable(context)
    }

    Function("startListening") { locale: String ->
      startRecognition(locale)
    }

    Function("stopListening") {
      stopRecognition()
    }

    OnDestroy {
      stopRecognition()
    }
  }

  private fun startRecognition(locale: String) {
    stopRecognition()

    val context = appContext.reactContext ?: run {
      sendEvent("onError", mapOf("message" to "No context available"))
      return
    }

    if (!SpeechRecognizer.isRecognitionAvailable(context)) {
      sendEvent("onError", mapOf("message" to "Speech recognition not available"))
      return
    }

    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
      setRecognitionListener(object : RecognitionListener {
        override fun onResults(results: Bundle?) {
          val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          val text = matches?.firstOrNull() ?: ""
          sendEvent("onTranscript", mapOf("text" to text, "isFinal" to true))
        }

        override fun onPartialResults(partialResults: Bundle?) {
          val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          val text = matches?.firstOrNull() ?: ""
          if (text.isNotEmpty()) {
            sendEvent("onTranscript", mapOf("text" to text, "isFinal" to false))
          }
        }

        override fun onError(error: Int) {
          val message = when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
            SpeechRecognizer.ERROR_CLIENT -> "Client error"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission denied"
            SpeechRecognizer.ERROR_NETWORK -> "Network error"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
            SpeechRecognizer.ERROR_NO_MATCH -> "No speech detected"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
            SpeechRecognizer.ERROR_SERVER -> "Server error"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
            else -> "Unknown error ($error)"
          }
          sendEvent("onError", mapOf("message" to message))
        }

        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
      })
    }

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
    }

    speechRecognizer?.startListening(intent)
  }

  private fun stopRecognition() {
    speechRecognizer?.stopListening()
    speechRecognizer?.destroy()
    speechRecognizer = null
  }
}
