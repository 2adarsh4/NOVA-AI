package ai.jarvis.nova;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class ReminderReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) {
    NotificationChannels.ensure(context);
    NotificationCompat.Builder notification = new NotificationCompat.Builder(context, NotificationChannels.REMINDERS)
      .setSmallIcon(android.R.drawable.ic_popup_reminder).setContentTitle("JARVIS reminder")
      .setContentText(intent.getStringExtra("text")).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true);
    NotificationManagerCompat.from(context).notify((int) System.currentTimeMillis(), notification.build());
  }
}
