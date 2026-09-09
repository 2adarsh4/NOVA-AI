// The onnx-community repository contains ONNX artifacts that Transformers.js
// can execute in a browser. The similarly named HuggingFaceTB repository
// contains PyTorch weights, so using it (or the un-namespaced name) makes the
// browser look for files that do not exist.
const MODEL_ID = 'onnx-community/SmolLM2-135M-Instruct-ONNX';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const SYSTEM_PROMPT = [
  'You are JARVIS, a helpful, concise personal AI assistant.',
  'Answer the user directly and accurately in one short sentence or phrase, then stop.',
  'For arithmetic, return the exact result and nothing else.',
  'Do not repeat yourself or claim capabilities you do not have.',
].join(' ');
const MAX_RESPONSE_TOKENS = 24;
const SMOLLM2_END_TOKEN_ID = 2;

let generatorPromise;

/** Load and initialize the local Transformers.js model once. */
async function getGenerator(loadTransformers) {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { env, pipeline } = await loadTransformers();
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      return pipeline('text-generation', MODEL_ID, { dtype: 'q4' });
    })().catch((error) => {
      generatorPromise = undefined;
      throw error;
    });
  }
  return generatorPromise;
}

function responseText(result) {
  const generated = Array.isArray(result) ? result[0]?.generated_text : result?.generated_text;
  if (Array.isArray(generated)) {
    const assistant = [...generated].reverse().find((message) => message?.role === 'assistant');
    return assistant?.content?.trim() ?? '';
  }
  if (typeof generated === 'string') {
    return generated.split('<|im_end|>')[0].split('<|im_start|>')[0].trim();
  }
  return '';
}

// A small parser is safer and more predictable than eval. It accepts only a
// standalone numeric expression and naturally observes standard precedence.
function evaluateExpression(expression) {
  const tokens = expression.match(/\d*\.?\d+|[()+\-*/]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) return null;
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];
  const primary = () => {
    if (peek() === '+') { take(); return primary(); }
    if (peek() === '-') { take(); const value = primary(); return value === null ? null : -value; }
    if (peek() === '(') {
      take();
      const value = sum();
      return take() === ')' ? value : null;
    }
    const token = take();
    const value = Number(token);
    return token !== undefined && /^\d*\.?\d+$/.test(token) && Number.isFinite(value) ? value : null;
  };
  const product = () => {
    let value = primary();
    while (value !== null && (peek() === '*' || peek() === '/')) {
      const operator = take();
      const right = primary();
      if (right === null || (operator === '/' && right === 0)) return null;
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (value !== null && (peek() === '+' || peek() === '-')) {
      const operator = take();
      const right = product();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  return position === tokens.length && Number.isFinite(value) ? value : null;
}

/** Return an exact answer for a standalone arithmetic question. */
export function exactArithmeticAnswer(message) {
  const expression = message.trim()
    .replace(/^what is\s+/i, '')
    .replace(/[?!.]+$/, '')
    .replace(/[×x]/gi, '*')
    .replace(/÷/g, '/')
    .trim();
  const value = evaluateExpression(expression);
  // Keep ordinary decimal answers readable without exposing binary float noise.
  return value === null ? '' : String(Number(value.toPrecision(15)));
}

/** Generate a response with the local SmolLM2 ONNX model. */
export async function generateNOVAResponse(message, {
  loadTransformers = () => import(TRANSFORMERS_URL),
} = {}) {
  const arithmeticAnswer = exactArithmeticAnswer(message);
  if (arithmeticAnswer) return arithmeticAnswer;

  const generator = await getGenerator(loadTransformers);
  const result = await generator([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message },
  ], {
    add_generation_prompt: true,
    max_new_tokens: MAX_RESPONSE_TOKENS,
    do_sample: false,
    eos_token_id: SMOLLM2_END_TOKEN_ID,
    pad_token_id: SMOLLM2_END_TOKEN_ID,
    return_full_text: false,
  });
  const reply = responseText(result);
  if (!reply) throw new Error('The JARVIS model returned an empty response.');
  return reply;
}

export function resetNOVAForTests() {
  generatorPromise = undefined;
}
