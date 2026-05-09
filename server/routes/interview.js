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
    const raw = (err.message || '').toLowerCase();
    const p = provider.toUpperCase();
    let errorMsg;

    if (raw.includes('rate') || raw.includes('429') || raw.includes('quota') || raw.includes('too many')) {
      errorMsg = `[${p} · RATE LIMIT] This provider hit its request limit mid-response. Your conversation up to this point is intact — switch to a different provider and continue from your last answer.`;
    } else if (raw.includes('safety') || raw.includes('blocked') || raw.includes('recitation')) {
      errorMsg = `[${p} · CONTENT BLOCK] The AI flagged that response and could not complete it. Your progress is saved. Try rephrasing your last answer or switch providers.`;
    } else if (raw.includes('401') || raw.includes('403') || raw.includes('api key') || raw.includes('authentication') || raw.includes('permission')) {
      errorMsg = `[${p} · AUTH ERROR] The API key for this provider is invalid or has no remaining credits. Switch to a different provider — your progress is intact.`;
    } else if (raw.includes('timeout') || raw.includes('econnreset') || raw.includes('etimedout') || raw.includes('network')) {
      errorMsg = `[${p} · TIMEOUT] The connection to this provider timed out. Your progress is intact. Try again or switch providers.`;
    } else if (raw.includes('context') || raw.includes('maximum context') || raw.includes('token') && raw.includes('length')) {
      errorMsg = `[${p} · CONTEXT LIMIT] The conversation has grown too long for this provider's context window. Switch to Anthropic or OpenAI which support longer contexts — your progress is intact.`;
    } else if (raw.includes('not configured') || raw.includes('api key not')) {
      errorMsg = `[${p} · NOT CONFIGURED] No API key is set for this provider. Go back and select a provider that has a key configured.`;
    } else {
      errorMsg = `[${p} · ERROR] ${err.message || 'An unexpected error occurred.'} Your progress is intact — try switching providers.`;
    }

    console.error(`[interview:${provider}]`, err.message);
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
