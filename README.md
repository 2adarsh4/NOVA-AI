# JARVIS AI

JARVIS AI is a browser-first personal assistant with a local SmolLM2 ONNX brain,
safe arithmetic handling, and browser voice input/output. The legacy `nova/`
directory and exported `initializeNOVA`/`generateNOVAResponse` names remain as
compatibility aliases; user-facing branding is JARVIS.

## Android

The `android/` source is a Capacitor host integration. It exposes only
allow-listed app launches, a saved-contact lookup followed by an explicit
confirmation and Android's dialer, alarms via the system Clock UI, and local
reminder notifications. It intentionally never starts calls directly and never
accepts arbitrary intents or package names from web content.

Wake-word listening is opt-in and runs only while the Android foreground service
has its persistent microphone notification. Android does not guarantee a
continuous wake word service: the OS/OEM may stop it, and a foreground service
cannot silently open the UI from the background or bypass the lock screen.
JARVIS posts a notification instead; users tap it to return to the assistant.
Lock-screen interaction is therefore limited to the OS-visible notification and
the normal device authentication rules.

## Development

```sh
npm install
npm test
npm run build
```

To produce the native host, install the matching Capacitor packages then sync:

```sh
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npm run android:sync
```
