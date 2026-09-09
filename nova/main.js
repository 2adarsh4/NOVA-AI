import { generateNOVAResponse } from './brain.js';
import { callSavedContact, getAndroidBridge, openAndroidApp, scheduleAndroidReminder, setAndroidAlarm, setWakeWordEnabled } from './android-bridge.js';

const SUPPORTED_APPS = {
  youtube: { label: 'YouTube', url: 'https://www.youtube.com/' },
};

/** Open only explicitly supported apps; never forward arbitrary commands/URLs to a native bridge. */
export function openSupportedApp(command, window) {
  const match = command.trim().match(/^open\s+(youtube)$/i);
  const app = match && SUPPORTED_APPS[match[1].toLowerCase()];
  if (!app) return null;
  const bridge = getAndroidBridge(window);
  if (bridge?.openApp) {
    // The native plugin receives an allow-listed identifier, not user text.
    void openAndroidApp(match[1].toLowerCase(), window).catch((error) => console.warn('Android app launch failed.', error));
    return `Opening ${app.label}.`;
  }
  try {
    const tab = window.open?.(app.url, '_blank', 'noopener,noreferrer');
    if (tab) { tab.opener = null; return `Opening ${app.label}.`; }
    if (typeof window.location?.assign === 'function') { window.location.assign(app.url); return `Opening ${app.label}.`; }
  } catch (error) { console.warn('Browser could not open the requested app.', error); }
  return `I could not open ${app.label} on this device.`;
}

function parseAlarm(text) {
  const match = text.match(/^set (?:an )?alarm for (\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3]) hour = (hour % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function parseReminder(text) {
  const match = text.match(/^remind me in (\d+)\s*(minute|minutes|hour|hours)\s+to\s+(.+)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const delayMs = amount * (/hour/i.test(match[2]) ? 3_600_000 : 60_000);
  return amount > 0 && delayMs <= 7 * 24 * 3_600_000 ? { delayMs, text: match[3].trim() } : null;
}

/** Connect the JARVIS controls once their DOM elements are available. Legacy name is kept for callers. */
export function initializeNOVA(document, window) {
  const { generateResponse = generateNOVAResponse } = arguments[2] ?? {};
  const chat = document.getElementById('chat');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('input');
  const voiceButton = document.getElementById('voice-button');
  const repeatButton = document.getElementById('repeat-button');
  const wakeWordButton = document.getElementById('wake-word-button');
  if (!chat || !form || !input || !voiceButton) return false;
  let lastResponse = '';
  let recognition;
  const appendMessage = (type, text) => {
    const message = document.createElement('div'); message.className = `message ${type}`; message.textContent = text;
    chat.appendChild(message); chat.scrollTop = chat.scrollHeight; return message;
  };
  const setSending = (sending) => { input.disabled = sending; const button = form.querySelector?.('button[type="submit"]'); if (button) button.disabled = sending; };
  const speakText = (text) => {
    const synth = window.speechSynthesis; const Utterance = window.SpeechSynthesisUtterance;
    if (!text || !synth || typeof Utterance !== 'function') return false;
    try { synth.cancel(); const utterance = new Utterance(text); utterance.onerror = () => console.warn('Voice playback is unavailable right now.'); synth.speak(utterance); return true; }
    catch (error) { console.warn('Unable to start voice playback.', error); return false; }
  };
  const deliverResponse = (text) => { lastResponse = text; appendMessage('jarvis', text); speakText(text); };
  const send = async (spokenText = input.value.trim()) => {
    const text = spokenText.trim(); if (!text) return;
    appendMessage('user', text); input.value = '';
    const appResponse = openSupportedApp(text, window);
    if (appResponse) { deliverResponse(appResponse); input.focus(); return; }
    const call = text.match(/^call\s+(.+)$/i);
    const alarm = parseAlarm(text); const reminder = parseReminder(text);
    if (call && getAndroidBridge(window)) { deliverResponse((await callSavedContact(call[1].trim(), window)).message); input.focus(); return; }
    if (alarm && getAndroidBridge(window)) { deliverResponse(await setAndroidAlarm(alarm.hour, alarm.minute, window)); input.focus(); return; }
    if (reminder && getAndroidBridge(window)) { deliverResponse(await scheduleAndroidReminder(reminder.delayMs, reminder.text, window)); input.focus(); return; }
    setSending(true); let thinkingMessage;
    try {
      thinkingMessage = appendMessage('jarvis', 'JARVIS is thinking…'); const response = await generateResponse(text);
      thinkingMessage.textContent = response; lastResponse = response; speakText(response);
    } catch (error) {
      console.error('Unable to generate a JARVIS response.', error);
      const message = 'I could not load my local AI brain. Please make sure the SmolLM2 model files are available and try again.';
      if (thinkingMessage?.classList?.contains('jarvis')) thinkingMessage.textContent = message; else appendMessage('jarvis', message);
    } finally { setSending(false); input.focus(); }
  };
  const startVoiceInput = async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition !== 'function') { appendMessage('jarvis', 'Voice input is not supported by this browser.'); return; }
    try { const stream = await window.navigator?.mediaDevices?.getUserMedia?.({ audio: true }); stream?.getTracks?.().forEach((track) => track.stop()); }
    catch (error) { appendMessage('jarvis', error?.name === 'NotAllowedError' || error?.name === 'SecurityError' ? 'Microphone permission was denied. Enable it in your browser settings and try again.' : 'I could not access your microphone. Check that it is available and try again.'); return; }
    recognition = new Recognition(); recognition.lang = window.navigator?.language || 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onresult = (event) => { const transcript = event.results?.[event.resultIndex ?? 0]?.[0]?.transcript?.trim(); if (transcript) void send(transcript); };
    recognition.onerror = (event) => appendMessage('jarvis', event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Microphone permission was denied. Enable it in your browser settings and try again.' : `Voice input failed${event.error ? ` (${event.error})` : ''}. Please try again.`);
    recognition.onend = () => { voiceButton.disabled = false; }; voiceButton.disabled = true;
    try { recognition.start(); } catch { voiceButton.disabled = false; appendMessage('jarvis', 'Voice input could not be started. Please try again.'); }
  };
  form.addEventListener('submit', (event) => { event.preventDefault(); void send(); });
  voiceButton.addEventListener('click', () => { void startVoiceInput(); });
  repeatButton?.addEventListener('click', () => { if (!speakText(lastResponse)) appendMessage('jarvis', 'Voice playback is not supported by this browser.'); });
  wakeWordButton?.addEventListener('click', async () => {
    const enabled = await setWakeWordEnabled(true, window);
    appendMessage('jarvis', enabled ? 'Wake-word listening is on while the Android foreground-service notification is visible. Say “Hello JARVIS.”' : 'Wake-word listening is only available in the Android app after microphone permission is granted.');
  });
  return true;
}

export const initializeJARVIS = initializeNOVA;
if (typeof document !== 'undefined' && typeof window !== 'undefined') { const start = () => initializeNOVA(document, window); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start(); }
