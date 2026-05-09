const express = require('express');
const { generateText } = require('../providers');
const { getCompressionPrompt } = require('../prompts/compression');
const { getDistillationPrompt } = require('../prompts/distillation');

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

  try {
    // Stage 1: forensic XML — structured analysis of the interview
    const persona = await generateText(
      provider,
      getCompressionPrompt(),
      [{ role: 'user', content: `Domain type: ${domainType}\n\nTranscript:\n\n${transcriptText}` }],
      4096
    );

    // Stage 2: about_me — distill forensic XML into a compact behavioral profile
    // ready to be pasted as system prompt context in any AI session
    const aboutMe = await generateText(
      provider,
      getDistillationPrompt(),
      [{ role: 'user', content: persona }],
      5000
    );

    req.session.destroy((err) => {
      if (err) console.error('Session destroy error after compile:', err.message);
    });

    res.json({ persona, aboutMe });
  } catch (err) {
    console.error('Compile error:', err.message);
    res.status(500).json({ error: `Provider error: ${err.message}` });
  }
});

module.exports = router;
