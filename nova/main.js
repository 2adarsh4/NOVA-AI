import { generateNOVAResponse } from './brain.js';

/**
 * Connect the NOVA controls once their DOM elements are available.
 *
 * Exporting the initializer makes the Vite entry module explicit and keeps all
 * browser-only work out of module evaluation, so importing this file cannot
 * fail merely because the document is still being parsed.
 */
export function initializeNOVA(document, window) {
  const { generateResponse = generateNOVAResponse } = arguments[2] ?? {};
  const chat = document.getElementById('chat');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('input');
  const voiceButton = document.getElementById('voice-button');

  if (!chat || !form || !input || !voiceButton) return false;

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

  const send = async () => {
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    setSending(true);

    let thinkingMessage;
    try {
      thinkingMessage = appendMessage('nova', 'NOVA is thinking…');
      const response = await generateResponse(text);
      thinkingMessage.textContent = response;
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

  const speak = () => {
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;

    if (!synth || typeof Utterance !== 'function') {
      appendMessage('nova', 'Voice playback is not supported by this browser.');
      return;
    }

    try {
      synth.cancel();
      const utterance = new Utterance('Hello, I am NOVA.');
      utterance.onerror = () => appendMessage('nova', 'Voice playback is unavailable right now.');
      synth.speak(utterance);
    } catch (error) {
      console.warn('Unable to start voice playback.', error);
      appendMessage('nova', 'Voice playback is unavailable right now.');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void send();
  });
  voiceButton.addEventListener('click', speak);
  return true;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const start = () => initializeNOVA(document, window);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
