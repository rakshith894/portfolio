export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages = [] } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'GROQ_API_KEY is not configured in Vercel. Please add it to Environment Variables.',
      });
    }

    const systemPrompt = `You are Nocturne, the intelligent AI guide for Rakshith's 3D interactive portfolio.
About Rakshith: Creative Developer studying Artificial Intelligence and Machine Learning at KVG College of Engineering.
Skills: AI/ML, Python, TypeScript, React, Next.js, Three.js, Node.js, Web Development.
World: Nocturne is a Gothic island with an interactive manor house, Skills Room with floating holograms, Project frames gallery, an apparition contact projector, rowing boat, and weather effects.
Respond politely, concisely, and helpfully. Keep answers under 3-4 sentences.
Always return JSON: {"reply": "your answer", "actions": []}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.6,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'AI service unavailable. Try again shortly.' });
    }

    const data = await groqRes.json();
    const rawContent = data.choices?.[0]?.message?.content;
    let parsed = { reply: 'Welcome to Nocturne!', actions: [] };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { reply: rawContent, actions: [] };
    }

    return res.status(200).json({
      reply: parsed.reply || 'Welcome to Nocturne!',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
