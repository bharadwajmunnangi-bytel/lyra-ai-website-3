// Vercel serverless function: keeps your Anthropic API key private and adds live web search.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
  const b = req.body || {};
  let messages = b.messages || [];
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'Bad request' });
  messages = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 6000)
  }));
  const body = { model: process.env.LYRA_MODEL || 'claude-haiku-5-5', max_tokens: 500, messages };
  if (b.live) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }];
  const call = () => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  try {
    let r = await call();
    if (!r.ok && body.tools) { delete body.tools; r = await call(); } // fall back if web search unavailable
    const d = await r.json();
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: 'AI error' });
    const text = (d.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
    res.status(200).json({ text });
  } catch (e) { res.status(502).json({ error: 'AI error' }); }
};
