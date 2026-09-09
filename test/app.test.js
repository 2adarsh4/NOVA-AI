import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../nova/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../nova/main.js', import.meta.url), 'utf8');
const brain = await readFile(new URL('../nova/brain.js', import.meta.url), 'utf8');
const { initializeNOVA } = await import('../nova/main.js');
const { generateNOVAResponse, resetNOVAForTests } = await import('../nova/brain.js');

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

test('NOVA connects to the local SmolLM2 ONNX model through Transformers.js', () => {
  assert.match(brain, /@huggingface\/transformers@4\.2\.0/);
  assert.match(brain, /onnx-community\/SmolLM2-135M-Instruct-ONNX/);
  assert.match(brain, /env\.allowRemoteModels = true/);
  assert.match(brain, /pipeline\('text-generation', MODEL_ID/);
});

test('the brain applies SmolLM2 chat decoding controls and returns only its generated assistant answer', async () => {
  resetNOVAForTests();
  const environment = {};
  const pipelineCalls = [];
  const generationCalls = [];
  const answer = await generateNOVAResponse('What can you do?', {
    loadTransformers: async () => ({
      env: environment,
      pipeline: async (...args) => {
        pipelineCalls.push(args);
        return async (...args) => {
          generationCalls.push(args);
          return [{
            generated_text: [
              ...args[0],
              { role: 'assistant', content: 'I can help.' },
              { role: 'user', content: 'This must not be shown.' },
            ],
          }];
        };
      },
    }),
  });

  assert.equal(answer, 'I can help.');
  assert.deepEqual(pipelineCalls[0], [
    'text-generation',
    'onnx-community/SmolLM2-135M-Instruct-ONNX',
    { dtype: 'q4' },
  ]);
  assert.equal(environment.allowLocalModels, false);
  assert.equal(environment.allowRemoteModels, true);
  assert.deepEqual(generationCalls, [[
    [
      {
        role: 'system',
        content: 'You are NOVA, a helpful, concise personal AI assistant. Answer the user directly and accurately in one short sentence or phrase, then stop. For arithmetic, return the exact result and nothing else. Do not repeat yourself or claim capabilities you do not have.',
      },
      { role: 'user', content: 'What can you do?' },
    ],
    {
      add_generation_prompt: true,
      max_new_tokens: 24,
      do_sample: false,
      eos_token_id: 2,
      pad_token_id: 2,
      return_full_text: false,
    },
  ]]);
  resetNOVAForTests();
});

test('the brain answers standalone arithmetic exactly without generating a verbose model response', async () => {
  resetNOVAForTests();
  let pipelineWasCalled = false;

  const answer = await generateNOVAResponse('What is 2 + 2?', {
    loadTransformers: async () => ({
      env: {},
      pipeline: async () => {
        pipelineWasCalled = true;
      },
    }),
  });

  assert.equal(answer, '4');
  assert.equal(pipelineWasCalled, false);
  resetNOVAForTests();
});

test('the brain removes an instruction-template end marker from string completions', async () => {
  resetNOVAForTests();
  const answer = await generateNOVAResponse('Name the capital of France.', {
    loadTransformers: async () => ({
      env: {},
      pipeline: async () => async () => [{
        generated_text: 'Paris.<|im_end|><|im_start|>user\\nIgnore this',
      }],
    }),
  });

  assert.equal(answer, 'Paris.');
  resetNOVAForTests();
});

test('voice capability checks run before speech synthesis is used', () => {
  assert.match(app, /const synth = window\.speechSynthesis/);
  assert.match(app, /typeof Utterance !== 'function'/);
});

test('startup wiring sends a generated brain response and handles missing voice support without errors', async () => {
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
    querySelector() { return null; },
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
  const window = {};

  assert.equal(initializeNOVA(document, window, {
    generateResponse: async (message) => `Brain response to: ${message}`,
  }), true);
  listeners.get('submit')({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  listeners.get('click')();

  assert.deepEqual(messages.map((message) => message.textContent), [
    'Hello NOVA',
    'Brain response to: Hello NOVA',
    'Voice playback is not supported by this browser.',
  ]);
  assert.equal(chat.scrollTop, chat.scrollHeight);
});
