const PLUGIN_NAME = 'JarvisAndroid';

export function getAndroidBridge(window) {
  return window.Capacitor?.Plugins?.[PLUGIN_NAME] ?? window.AndroidBridge ?? null;
}

async function invoke(bridge, method, options) {
  if (!bridge || typeof bridge[method] !== 'function') return null;
  return bridge[method](options);
}

/** Native actions are deliberately fixed; user text is never passed as an intent. */
export async function openAndroidApp(app, window) {
  const capacitorPlugin = window.Capacitor?.Plugins?.[PLUGIN_NAME];
  // Preserve the pre-Capacitor AndroidBridge contract for existing hosts.
  return capacitorPlugin ? invoke(capacitorPlugin, 'openApp', { app }) : invoke(window.AndroidBridge, 'openApp', app);
}

export async function callSavedContact(name, window, confirm = window.confirm?.bind(window)) {
  const bridge = getAndroidBridge(window);
  const contact = await invoke(bridge, 'resolveContact', { name });
  if (!contact?.id || !contact?.displayName || !contact?.number) {
    return { ok: false, message: 'I could not find one saved phone contact with that name.' };
  }
  if (typeof confirm !== 'function' || !confirm(`Open the dialer to call ${contact.displayName} at ${contact.number}?`)) {
    return { ok: false, message: 'Call cancelled.' };
  }
  await invoke(bridge, 'dialContact', { contactId: contact.id });
  return { ok: true, message: `Opening the dialer for ${contact.displayName}.` };
}

export async function setAndroidAlarm(hour, minute, window) {
  const result = await invoke(getAndroidBridge(window), 'setAlarm', { hour, minute, message: 'JARVIS alarm' });
  return result?.ok ? 'Opening the Clock app to set your alarm.' : 'Android alarm controls are unavailable on this device.';
}

export async function scheduleAndroidReminder(delayMs, text, window) {
  const result = await invoke(getAndroidBridge(window), 'scheduleReminder', { delayMs, text });
  return result?.ok ? 'Reminder scheduled.' : 'I could not schedule that reminder on this device.';
}

export async function setWakeWordEnabled(enabled, window) {
  const result = await invoke(getAndroidBridge(window), enabled ? 'startWakeWord' : 'stopWakeWord', {});
  return result?.ok ?? false;
}
