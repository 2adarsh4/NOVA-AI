package ai.jarvis.nova;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

final class NotificationChannels {
  static final String REMINDERS = "jarvis_reminders", WAKE_WORD = "jarvis_wake_word";
  static void ensure(Context context) { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
    NotificationManager manager = context.getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel(REMINDERS, "JARVIS reminders", NotificationManager.IMPORTANCE_HIGH));
    manager.createNotificationChannel(new NotificationChannel(WAKE_WORD, "JARVIS wake word", NotificationManager.IMPORTANCE_LOW));
  }}
}
