const replyText = 'I received your message. My AI brain will be connected next. 🧠';

/**
 * Connect the NOVA controls once their DOM elements are available.
 *
 * Exporting the initializer makes the Vite entry module explicit and keeps all
 * browser-only work out of module evaluation, so importing this file cannot
 * fail merely because the document is still being parsed.
 */
export function initializeNOVA(document, window) {
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
  };

  const send = () => {
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';
    input.focus();
    window.setTimeout(() => appendMessage('nova', replyText), 400);
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
    send();
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
