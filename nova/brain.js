const MODEL_ID = 'SmolLM2-135M-Instruct-ONNX';
const SYSTEM_PROMPT = [
  'You are NOVA, a helpful, concise personal AI assistant.',
  'Answer the user directly and accurately. Do not claim to have capabilities you do not have.',
].join(' ');

let generatorPromise;

/** Load and initialize the local Transformers.js model once. */
async function getGenerator(loadTransformers) {
  if (!generatorPromise) {
    generatorPromise = (async () => {
      const { env, pipeline } = await loadTransformers();

      // NOVA is offline: model assets must come from the app, not a remote hub.
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.localModelPath = '/models/';

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
  loadTransformers = () => import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'),
} = {}) {
  const generator = await getGenerator(loadTransformers);
  const result = await generator([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message },
  ], {
    max_new_tokens: 192,
    do_sample: false,
    return_full_text: false,
  });

  const reply = responseText(result);
  if (!reply) throw new Error('The NOVA model returned an empty response.');
  return reply;
}

export function resetNOVAForTests() {
  generatorPromise = undefined;
}
