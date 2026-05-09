const express = require('express');
const { generateText } = require('../providers');
const { getCompressionPrompt } = require('../prompts/compression');

const router = express.Router();

const VALID_PROVIDERS = ['anthropic', 'openai', 'gemini'];

router.post('/', async (req, res) => {
  if (!req.session.compileUnlocked) {
    return res.status(403).json({ error: 'Interview not complete' });
  }

  const transcript = req.session.transcript || [];
  if (transcript.length === 0) {
    return res.status(400).json({ error: 'No transcript to compile' });
  }

  const { provider = 'anthropic' } = req.body;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  const domainType = req.session.domainType || 'general';

  const transcriptText = transcript
    .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n\n');

  const systemPrompt = getCompressionPrompt();
  const userMessage = `Domain type: ${domainType}\n\nTranscript:\n\n${transcriptText}`;

  try {
    const persona = await generateText(
      provider,
      systemPrompt,
      [{ role: 'user', content: userMessage }],
      4096
    );

    req.session.destroy((err) => {
      if (err) console.error('Session destroy error after compile:', err.message);
    });

    res.json({ persona });
  } catch (err) {
    console.error('Compile error:', err.message);
    res.status(500).json({ error: `Provider error: ${err.message}` });
  }
});

module.exports = router;
