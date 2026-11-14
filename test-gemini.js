require('dotenv').config({ override: true });
const key = process.env.GEMINI_API_KEY;
const base = 'https://generativelanguage.googleapis.com/v1beta';

async function t(model) {
  const s = Date.now();
  try {
    const r = await fetch(`${base}/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say hi in 3 words' }] }] }),
    });
    console.log(model, '->', r.status, Date.now() - s, 'ms');
    if (!r.ok) console.log((await r.text()).slice(0, 200));
  } catch (e) {
    console.log(model, '-> FAILED', e.message);
  }
}

(async () => {
  console.log('Your GEMINI_MODEL:', process.env.GEMINI_MODEL);
  await t(process.env.GEMINI_MODEL);
  try {
    const r = await fetch(`${base}/models?pageSize=100`, { headers: { 'x-goog-api-key': key } });
    const names = ((await r.json()).models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .filter((n) => n.includes('flash'))
      .slice(0, 4);
    console.log('Flash models on your key:', names.join(', '));
    for (const n of names) if (n !== process.env.GEMINI_MODEL) await t(n);
  } catch (e) {
    console.log('Could not list models:', e.message);
  }
})();