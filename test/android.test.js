import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { callSavedContact, openAndroidApp } from '../nova/android-bridge.js';

const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
const plugin = await readFile(new URL('../android/app/src/main/java/ai/jarvis/nova/JarvisAndroidPlugin.java', import.meta.url), 'utf8');
const service = await readFile(new URL('../android/app/src/main/java/ai/jarvis/nova/WakeWordService.java', import.meta.url), 'utf8');

test('Android integration requests only necessary permissions and exposes a microphone foreground service', () => {
  assert.match(manifest, /RECORD_AUDIO/);
  assert.match(manifest, /READ_CONTACTS/);
  assert.match(manifest, /FOREGROUND_SERVICE_MICROPHONE/);
  assert.doesNotMatch(manifest, /CALL_PHONE/);
  assert.match(manifest, /foregroundServiceType="microphone"/);
});

test('saved contacts require an explicit browser confirmation and use Android dialer', async () => {
  const calls = [];
  const window = { Capacitor: { Plugins: { JarvisAndroid: {
    resolveContact: async () => ({ id: 12, displayName: 'Ada', number: '555-0100' }),
    dialContact: async (options) => calls.push(options),
  } } } };
  const result = await callSavedContact('Ada', window, () => true);
  assert.deepEqual(result, { ok: true, message: 'Opening the dialer for Ada.' });
  assert.deepEqual(calls, [{ contactId: 12 }]);
  assert.match(plugin, /Intent\.ACTION_DIAL/);
  assert.match(plugin, /CALL_PHONE is intentionally not requested/);
});

test('Capacitor calls receive a fixed app identifier while legacy AndroidBridge remains compatible', async () => {
  const capacitor = []; const legacy = [];
  await openAndroidApp('youtube', { Capacitor: { Plugins: { JarvisAndroid: { openApp: (value) => capacitor.push(value) } } } });
  await openAndroidApp('youtube', { AndroidBridge: { openApp: (value) => legacy.push(value) } });
  assert.deepEqual(capacitor, [{ app: 'youtube' }]);
  assert.deepEqual(legacy, ['youtube']);
});

test('wake-word design is foreground and notification-based, not a lock-screen bypass', () => {
  assert.match(service, /startForeground/);
  assert.match(service, /notifies rather than launching activities over the lock screen/);
  assert.match(service, /SpeechRecognizer/);
  assert.doesNotMatch(service, /startActivity/);
  assert.match(plugin, /AlarmClock\.ACTION_SET_ALARM/);
  assert.match(plugin, /setAndAllowWhileIdle/);
});
