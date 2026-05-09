const express = require('express');
const { streamChat } = require('../providers');
const { getElicitationPrompt } = require('../prompts/elicitation');

const router = express.Router();

const VALID_PROVIDERS = ['anthropic', 'openai', 'gemini'];

router.post('/', async (req, res) => {
  if (!req.session.domainType) {
    return res.status(400).json({ error: 'Session not initialized' });
  }

  const { message, provider = 'anthropic' } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Missing message' });
  }
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  req.session.transcript.push({ role: 'user', content: message });
  req.session.exchangeCount = (req.session.exchangeCount || 0) + 1;

  const systemPrompt = getElicitationPrompt(req.session.domainType);
  const messages = req.session.transcript.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let fullResponse = '';
  let textBuffer = '';

  function flushBuffer(force = false) {
    const bracketIdx = textBuffer.indexOf('[');
    const safeEnd = force ? textBuffer.length : (bracketIdx === -1 ? textBuffer.length : bracketIdx);
    if (safeEnd > 0) {
      const chunk = textBuffer.slice(0, safeEnd);
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      textBuffer = textBuffer.slice(safeEnd);
    }
  }

  try {
    for await (const text of streamChat(provider, systemPrompt, messages, 4096)) {
      textBuffer += text;
      fullResponse += text;

      // Extract all complete [DOMAIN:x] tokens from the buffer
      while (true) {
        const domainMatch = textBuffer.match(/\[DOMAIN:(\w+)\]/);
        if (!domainMatch) break;

        const before = textBuffer.slice(0, domainMatch.index);
        if (before) {
          res.write(`data: ${JSON.stringify({ text: before })}\n\n`);
        }

        const domainValue = domainMatch[1];
        res.write(`data: ${JSON.stringify({ domain: domainValue })}\n\n`);

        if (domainValue !== 'complete') req.session.currentDomain = domainValue;
        if (domainValue === 'complete') req.session.compileUnlocked = true;

        textBuffer = textBuffer.slice(domainMatch.index + domainMatch[0].length);
      }

      flushBuffer(false);
    }

    flushBuffer(true);

    req.session.transcript.push({ role: 'assistant', content: fullResponse });

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.write(`data: ${JSON.stringify({ done: true, compileUnlocked: req.session.compileUnlocked })}\n\n`);
  } catch (err) {
    console.error('Stream error:', err.message);
    res.write(`data: ${JSON.stringify({ error: `Provider error: ${err.message}. Try switching providers or check your API key.` })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
