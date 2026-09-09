// The onnx-community repository contains ONNX artifacts that Transformers.js
// can execute in a browser. The similarly named HuggingFaceTB repository
// contains PyTorch weights, so using it (or the un-namespaced name) makes the
// browser look for files that do not exist.
const MODEL_ID = 'onnx-community/SmolLM2-135M-Instruct-ONNX';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const SYSTEM_PROMPT = [
  'You are NOVA, a helpful, concise personal AI assistant.',
  'Answer the user directly and accurately, then stop.',
  'Do not repeat yourself or claim capabilities you do not have.',
].join(' ');
const MAX_RESPONSE_TOKENS = 64;
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

  if (typeof generated === 'string') return generated.trim();
  if (Array.isArray(generated)) return generated.at(-1)?.content?.trim() ?? '';
  return '';
}

/** Generate a response with the local SmolLM2 ONNX model. */
export async function generateNOVAResponse(message, {
  // Kept lazy so NOVA's UI starts before the browser fetches Transformers.js.
  loadTransformers = () => import(TRANSFORMERS_URL),
} = {}) {
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
    // A small instruction model can loop when it is allowed to generate far
    // beyond a normal chat reply. Greedy decoding plus repetition controls and
    // the model's explicit end token produces stable, concise answers.
    max_new_tokens: MAX_RESPONSE_TOKENS,
    do_sample: false,
    repetition_penalty: 1.15,
    no_repeat_ngram_size: 3,
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
