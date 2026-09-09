import { generateNOVAResponse } from './brain.js';

const SUPPORTED_APPS = {
  youtube: { label: 'YouTube', url: 'https://www.youtube.com/' },
};

/** Open only explicitly supported apps; never forward arbitrary commands/URLs to a native bridge. */
export function openSupportedApp(command, window) {
  const match = command.trim().match(/^open\s+(youtube)$/i);
  const app = match && SUPPORTED_APPS[match[1].toLowerCase()];
  if (!app) return null;

  const bridge = window.AndroidBridge;
  try {
    // Android WebView bridges are supplied by the host app. Pass a fixed
    // allow-listed identifier, not user-controlled text or an intent URI.
    if (bridge && typeof bridge.openApp === 'function') {
      bridge.openApp(match[1].toLowerCase());
      return `Opening ${app.label}.`;
    }
  } catch (error) {
    console.warn('Android bridge could not open the requested app.', error);
  }

  try {
    const tab = window.open?.(app.url, '_blank', 'noopener,noreferrer');
    if (tab) {
      tab.opener = null;
      return `Opening ${app.label}.`;
    }
    // A popup may be blocked (for example after an asynchronous speech
    // result). In that case use the same allow-listed HTTPS URL in this tab.
    if (typeof window.location?.assign === 'function') {
      window.location.assign(app.url);
      return `Opening ${app.label}.`;
    }
    return `I could not open ${app.label} on this device.`;
  } catch (error) {
    console.warn('Browser could not open the requested app.', error);
    return `I could not open ${app.label} on this device.`;
  }
}

/** Connect the NOVA controls once their DOM elements are available. */
export function initializeNOVA(document, window) {
  const { generateResponse = generateNOVAResponse } = arguments[2] ?? {};
  const chat = document.getElementById('chat');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('input');
  const voiceButton = document.getElementById('voice-button');
  const repeatButton = document.getElementById('repeat-button');
  if (!chat || !form || !input || !voiceButton) return false;

  let lastResponse = '';
  let recognition;
  const appendMessage = (type, text) => {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;
    return message;
  };
  const setSending = (sending) => {
    input.disabled = sending;
    const sendButton = form.querySelector?.('button[type="submit"]');
    if (sendButton) sendButton.disabled = sending;
  };
  const speakText = (text) => {
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!text || !synth || typeof Utterance !== 'function') return false;
    try {
      synth.cancel();
      const utterance = new Utterance(text);
      utterance.onerror = () => console.warn('Voice playback is unavailable right now.');
      synth.speak(utterance);
      return true;
    } catch (error) {
      console.warn('Unable to start voice playback.', error);
      return false;
    }
  };
  const deliverResponse = (text) => {
    lastResponse = text;
    appendMessage('nova', text);
    speakText(text);
  };
  const send = async (spokenText = input.value.trim()) => {
    const text = spokenText.trim();
    if (!text) return;
    appendMessage('user', text);
    input.value = '';
    const appResponse = openSupportedApp(text, window);
    if (appResponse) {
      deliverResponse(appResponse);
      input.focus();
      return;
    }
    setSending(true);
    let thinkingMessage;
    try {
      thinkingMessage = appendMessage('nova', 'NOVA is thinking…');
      const response = await generateResponse(text);
      thinkingMessage.textContent = response;
      lastResponse = response;
      speakText(response);
    } catch (error) {
      console.error('Unable to generate a NOVA response.', error);
      const message = 'I could not load my local AI brain. Please make sure the SmolLM2 model files are available and try again.';
      if (thinkingMessage?.classList?.contains('nova')) thinkingMessage.textContent = message;
      else appendMessage('nova', message);
    } finally {
      setSending(false);
      input.focus();
    }
  };
  const startVoiceInput = async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition !== 'function') {
      appendMessage('nova', 'Voice input is not supported by this browser.');
      return;
    }
    // Request microphone permission explicitly so denial can be explained
    // before starting recognition. Recognition still owns the capture stream.
    try {
      const stream = await window.navigator?.mediaDevices?.getUserMedia?.({ audio: true });
      stream?.getTracks?.().forEach((track) => track.stop());
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
      appendMessage('nova', denied
        ? 'Microphone permission was denied. Enable it in your browser settings and try again.'
        : 'I could not access your microphone. Check that it is available and try again.');
      return;
    }
    recognition = new Recognition();
    recognition.lang = window.navigator?.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[event.resultIndex ?? 0]?.[0]?.transcript?.trim();
      if (transcript) void send(transcript);
    };
    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone permission was denied. Enable it in your browser settings and try again.'
        : `Voice input failed${event.error ? ` (${event.error})` : ''}. Please try again.`;
      appendMessage('nova', message);
    };
    recognition.onend = () => { voiceButton.disabled = false; };
    voiceButton.disabled = true;
    try { recognition.start(); } catch (error) {
      voiceButton.disabled = false;
      appendMessage('nova', 'Voice input could not be started. Please try again.');
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); void send(); });
  voiceButton.addEventListener('click', () => { void startVoiceInput(); });
  repeatButton?.addEventListener('click', () => {
    if (!speakText(lastResponse)) appendMessage('nova', 'Voice playback is not supported by this browser.');
  });
  return true;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const start = () => initializeNOVA(document, window);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
