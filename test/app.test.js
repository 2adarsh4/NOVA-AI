import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../nova/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../nova/main.js', import.meta.url), 'utf8');
const { initializeNOVA } = await import('../nova/main.js');

test('the Vite HTML entry loads the NOVA module entry point', () => {
  assert.match(html, /<script type="module" src="\/main\.js"><\/script>/);
  assert.match(app, /export function initializeNOVA\(document, window\)/);
});

test('NOVA has the DOM hooks required during startup', () => {
  for (const id of ['chat', 'chat-form', 'input', 'voice-button']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('messages are rendered as text rather than injected HTML', () => {
  assert.match(app, /message\.textContent = text/);
  assert.doesNotMatch(app, /message\.innerHTML\s*=/);
});

test('voice capability checks run before speech synthesis is used', () => {
  assert.match(app, /const synth = window\.speechSynthesis/);
  assert.match(app, /typeof Utterance !== 'function'/);
});

test('startup wiring sends messages and handles missing voice support without errors', () => {
  const listeners = new Map();
  const messages = [];
  const input = {
    value: 'Hello NOVA',
    focus() {},
  };
  const chat = {
    appendChild(message) {
      messages.push(message);
    },
    scrollHeight: 42,
    scrollTop: 0,
  };
  const form = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const voiceButton = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const document = {
    getElementById(id) {
      return { chat, 'chat-form': form, input, 'voice-button': voiceButton }[id] ?? null;
    },
    createElement() {
      return {};
    },
  };
  const window = {
    setTimeout(callback) {
      callback();
    },
  };

  assert.equal(initializeNOVA(document, window), true);
  listeners.get('submit')({ preventDefault() {} });
  listeners.get('click')();

  assert.deepEqual(messages.map((message) => message.textContent), [
    'Hello NOVA',
    'I received your message. My AI brain will be connected next. 🧠',
    'Voice playback is not supported by this browser.',
  ]);
  assert.equal(chat.scrollTop, chat.scrollHeight);
});
