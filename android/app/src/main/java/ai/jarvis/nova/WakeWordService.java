package ai.jarvis.nova;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import java.util.ArrayList;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** A visible, opt-in microphone service. It notifies rather than launching activities over the lock screen. */
public class WakeWordService extends Service {
  private SpeechRecognizer recognizer;
  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    NotificationChannels.ensure(this);
    startForeground(7, new NotificationCompat.Builder(this, NotificationChannels.WAKE_WORD)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("JARVIS wake word is listening")
      .setContentText("Say “Hello JARVIS” while this notification is visible.").setOngoing(true).build());
    if (!SpeechRecognizer.isRecognitionAvailable(this)) return START_NOT_STICKY;
    recognizer = SpeechRecognizer.createSpeechRecognizer(this);
    recognizer.setRecognitionListener(new RecognitionListener() {
      @Override public void onResults(android.os.Bundle results) {
        ArrayList<String> phrases = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (phrases != null) for (String phrase : phrases) if (phrase.toLowerCase().contains("hello jarvis")) notifyWakeWord();
        listen();
      }
      @Override public void onError(int error) { listen(); }
      @Override public void onReadyForSpeech(android.os.Bundle params) { }
      @Override public void onBeginningOfSpeech() { }
      @Override public void onRmsChanged(float rmsdB) { }
      @Override public void onBufferReceived(byte[] buffer) { }
      @Override public void onEndOfSpeech() { }
      @Override public void onPartialResults(android.os.Bundle partialResults) { }
      @Override public void onEvent(int eventType, android.os.Bundle params) { }
    });
    listen();
    return START_NOT_STICKY;
  }
  private void listen() { if (recognizer != null) recognizer.startListening(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)); }
  private void notifyWakeWord() { NotificationManagerCompat.from(this).notify(8, new NotificationCompat.Builder(this, NotificationChannels.WAKE_WORD).setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("JARVIS is ready").setContentText("Wake word heard. Tap to continue in JARVIS.").setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build()); }
  @Override public void onDestroy() { if (recognizer != null) { recognizer.destroy(); recognizer = null; } super.onDestroy(); }
  @Override public IBinder onBind(Intent intent) { return null; }
}
