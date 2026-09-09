package ai.jarvis.nova;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Native boundary: every action is allow-listed and performs no arbitrary intent dispatch. */
@CapacitorPlugin(name = "JarvisAndroid", permissions = {
  @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
  @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
  @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
})
public class JarvisAndroidPlugin extends Plugin {
  @PluginMethod public void openApp(PluginCall call) {
    String app = call.getString("app", "");
    if (!"youtube".equals(app)) { call.reject("Unsupported app"); return; }
    Intent launch = getContext().getPackageManager().getLaunchIntentForPackage("com.google.android.youtube");
    if (launch == null) launch = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/"));
    getActivity().startActivity(launch); call.resolve();
  }

  @PluginMethod public void resolveContact(PluginCall call) {
    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissionForAlias("contacts", call, "contactsPermissionCallback"); return;
    }
    String name = call.getString("name", "").trim();
    if (name.isEmpty()) { call.reject("Contact name is required"); return; }
    String[] projection = { ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER };
    try (Cursor cursor = getContext().getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection,
      ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " = ?", new String[] { name }, null)) {
      if (cursor == null || cursor.getCount() != 1 || !cursor.moveToFirst()) { call.resolve(new JSObject()); return; }
      JSObject result = new JSObject(); result.put("id", cursor.getLong(0)); result.put("displayName", cursor.getString(1)); result.put("number", cursor.getString(2)); call.resolve(result);
    }
  }

  @PluginMethod public void dialContact(PluginCall call) {
    // ACTION_DIAL leaves the final call confirmation to Android's dialer; CALL_PHONE is intentionally not requested.
    long id = call.getLong("contactId", -1L); if (id < 0) { call.reject("Contact id is required"); return; }
    Uri uri = Uri.withAppendedPath(ContactsContract.Contacts.CONTENT_URI, String.valueOf(id));
    Intent dial = new Intent(Intent.ACTION_DIAL, uri); getActivity().startActivity(dial); call.resolve();
  }

  @PluginMethod public void setAlarm(PluginCall call) {
    int hour = call.getInt("hour", -1), minute = call.getInt("minute", -1);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) { call.reject("Invalid alarm time"); return; }
    Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM).putExtra(AlarmClock.EXTRA_HOUR, hour).putExtra(AlarmClock.EXTRA_MINUTES, minute).putExtra(AlarmClock.EXTRA_MESSAGE, "JARVIS alarm").putExtra(AlarmClock.EXTRA_SKIP_UI, false);
    getActivity().startActivity(intent); JSObject result = new JSObject(); result.put("ok", true); call.resolve(result);
  }

  @PluginMethod public void scheduleReminder(PluginCall call) {
    if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) { requestPermissionForAlias("notifications", call, "notificationsReminderCallback"); return; }
    long delay = call.getLong("delayMs", 0L); String text = call.getString("text", "Reminder");
    if (delay < 60_000L || delay > 604_800_000L) { call.reject("Reminder must be between one minute and seven days"); return; }
    Intent intent = new Intent(getContext(), ReminderReceiver.class).putExtra("text", text);
    PendingIntent pending = PendingIntent.getBroadcast(getContext(), (int) System.currentTimeMillis(), intent, PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
    ((AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delay, pending);
    JSObject result = new JSObject(); result.put("ok", true); call.resolve(result);
  }

  @PluginMethod public void startWakeWord(PluginCall call) {
    if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { requestPermissionForAlias("microphone", call, "microphonePermissionCallback"); return; }
    if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) { requestPermissionForAlias("notifications", call, "notificationsWakeWordCallback"); return; }
    ContextCompat.startForegroundService(getContext(), new Intent(getContext(), WakeWordService.class)); JSObject result = new JSObject(); result.put("ok", true); call.resolve(result);
  }
  @PluginMethod public void stopWakeWord(PluginCall call) { getContext().stopService(new Intent(getContext(), WakeWordService.class)); JSObject result = new JSObject(); result.put("ok", true); call.resolve(result); }
  @PermissionCallback private void contactsPermissionCallback(PluginCall call) { resolveContact(call); }
  @PermissionCallback private void microphonePermissionCallback(PluginCall call) { startWakeWord(call); }
  @PermissionCallback private void notificationsReminderCallback(PluginCall call) { scheduleReminder(call); }
  @PermissionCallback private void notificationsWakeWordCallback(PluginCall call) { startWakeWord(call); }
}
