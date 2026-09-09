import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../nova/index.html', import.meta.url), 'utf8');

test('NOVA has the DOM hooks required during startup', () => {
  for (const id of ['chat', 'chat-form', 'input', 'voice-button']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('messages are rendered as text rather than injected HTML', () => {
  assert.match(html, /message\.textContent = text/);
  assert.doesNotMatch(html, /message\.innerHTML\s*=/);
});

test('voice capability checks run before speech synthesis is used', () => {
  assert.match(html, /'speechSynthesis' in window/);
  assert.match(html, /typeof window\.SpeechSynthesisUtterance !== 'function'/);
});
