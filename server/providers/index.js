const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function getAvailableProviders() {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };
}

// Convert internal {role, content} messages to OpenAI format (system as first message)
function toOpenAIMessages(systemPrompt, messages) {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// Convert internal messages to Gemini format (role: user|model, parts: [{text}])
function toGeminiContents(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// Async generator — yields text string chunks as they stream in.
// Routes iterate this directly; they never touch provider SDKs.
async function* streamChat(provider, systemPrompt, messages, maxTokens = 1024) {
  if (provider === 'anthropic') {
    if (!anthropic) throw new Error('Anthropic API key not configured');
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  } else if (provider === 'openai') {
    if (!openai) throw new Error('OpenAI API key not configured');
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      stream: true,
      messages: toOpenAIMessages(systemPrompt, messages),
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  } else if (provider === 'gemini') {
    if (!geminiClient) throw new Error('Gemini API key not configured');
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContentStream({
      contents: toGeminiContents(messages),
    });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

// Returns the complete response text in one call — used for compilation.
async function generateText(provider, systemPrompt, messages, maxTokens = 4096) {
  if (provider === 'anthropic') {
    if (!anthropic) throw new Error('Anthropic API key not configured');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });
    return response.content[0]?.text || '';
  } else if (provider === 'openai') {
    if (!openai) throw new Error('OpenAI API key not configured');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      messages: toOpenAIMessages(systemPrompt, messages),
    });
    return response.choices[0]?.message?.content || '';
  } else if (provider === 'gemini') {
    if (!geminiClient) throw new Error('Gemini API key not configured');
    const model = geminiClient.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({
      contents: toGeminiContents(messages),
    });
    return result.response.text() || '';
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }
}

module.exports = { streamChat, generateText, getAvailableProviders };
