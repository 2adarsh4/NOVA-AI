// The onnx-community repository contains ONNX artifacts that Transformers.js
// can execute in a browser. The similarly named HuggingFaceTB repository
// contains PyTorch weights, so using it (or the un-namespaced name) makes the
// browser look for files that do not exist.
const MODEL_ID = 'onnx-community/SmolLM2-135M-Instruct-ONNX';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const SYSTEM_PROMPT = [
  'You are NOVA, a helpful, concise personal AI assistant.',
  'Answer the user directly and accurately in one short sentence or phrase, then stop.',
  'For arithmetic, return the exact result and nothing else.',
  'Do not repeat yourself or claim capabilities you do not have.',
].join(' ');
// Most browser-chat replies fit comfortably in 24 tokens. Keeping this small
// makes generation noticeably faster and prevents a small local model from
// drifting into a second answer or a new chat turn.
const MAX_RESPONSE_TOKENS = 24;
// SmolLM2 uses token 2 for both its end-of-sequence and padding tokens. Set
// these explicitly because generation otherwise only stops at the token cap
// when a runtime does not carry the model generation config into the pipeline.
const SMOLLM2_END_TOKEN_ID = 2;

let generatorPromise;

/** Load and initialize the local Transformers.js model once. */
async function getGenerator(loadTransformers) {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { env, pipeline } = await loadTransformers();

      // Inference runs in the browser. Let Transformers.js obtain the ONNX
      // model and tokenizer from the Hub on first use (then the browser cache
      // can reuse them). The app does not ship a /models directory, so forcing
      // local-only asset resolution previously guaranteed a 404 at startup.
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
    // Chat generation returns the full message list in some Transformers.js
    // versions. Only expose the newly generated assistant turn, never the
    // prompt or a subsequent user turn.
    const assistant = [...generated].reverse().find((message) => message?.role === 'assistant');
    return assistant?.content?.trim() ?? '';
  }
  if (typeof generated === 'string') {
    // return_full_text: false should already return just the completion. The
    // delimiters are still removed defensively for runtimes that ignore it.
    return generated
      .split('<|im_end|>')[0]
      .split('<|im_start|>')[0]
      .trim();
  }
  return '';
}

/** Return an exact answer for a standalone two-operand arithmetic question. */
function exactArithmeticAnswer(message) {
  const expression = message
    .trim()
    .replace(/^what is\s+/i, '')
    .replace(/[?!.]+$/, '')
    .trim();
  const match = expression.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return '';

  const [, leftText, operator, rightText] = match;
  const left = Number(leftText);
  const right = Number(rightText);
  if (!Number.isFinite(left) || !Number.isFinite(right) || (operator === '/' && right === 0)) return '';

  const answer = ({ '+': left + right, '-': left - right, '*': left * right, '/': left / right })[operator];
  return Number.isFinite(answer) ? String(answer) : '';
}

/** Generate a response with the local SmolLM2 ONNX model. */
export async function generateNOVAResponse(message, {
  // Kept lazy so NOVA's UI starts before the browser fetches Transformers.js.
  loadTransformers = () => import(TRANSFORMERS_URL),
} = {}) {
  // Arithmetic is both common and objective. Answering it locally avoids a
  // model download/generation round trip and guarantees that questions such
  // as "2+2" cannot be answered with a hallucination or a repeated prompt.
  const arithmeticAnswer = exactArithmeticAnswer(message);
  if (arithmeticAnswer) return arithmeticAnswer;

  const generator = await getGenerator(loadTransformers);
  const result = await generator([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message },
  ], {
    // Supplying role/content messages lets Transformers.js apply SmolLM2's
    // native chat template, including the assistant generation prompt. Do not
    // concatenate a plain-text prompt here: that makes the model continue the
    // conversation template instead of answering the user.
    add_generation_prompt: true,
    // Greedy decoding is deterministic. A short token budget and the model's
    // explicit end token stop the response before it can loop or begin a new
    // chat turn.
    max_new_tokens: MAX_RESPONSE_TOKENS,
    do_sample: false,
    eos_token_id: SMOLLM2_END_TOKEN_ID,
    pad_token_id: SMOLLM2_END_TOKEN_ID,
    return_full_text: false,
  });

  const reply = responseText(result);
  if (!reply) throw new Error('The NOVA model returned an empty response.');
  return reply;
}

export function resetNOVAForTests() {
  generatorPromise = undefined;
}
