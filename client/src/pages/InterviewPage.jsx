import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import DomainBadge from '../components/DomainBadge';
import ChatWindow from '../components/ChatWindow';

const DOMAIN_ORDER = ['voice', 'beliefs', 'decisions', 'conflict', 'taste'];

const PROVIDER_META = {
  anthropic: { label: 'Anthropic', model: 'Claude Sonnet 4.6', color: '#cc785c' },
  openai:    { label: 'OpenAI',    model: 'GPT-4o',            color: '#74aa9c' },
  gemini:    { label: 'Google',    model: 'Gemini 2.5 Flash',  color: '#4285f4' },
};

export default function InterviewPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('select');
  const [domainType, setDomainType] = useState('general');
  const [provider, setProvider] = useState('anthropic');
  const [availableProviders, setAvailableProviders] = useState(null); // null = loading
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [currentDomain, setCurrentDomain] = useState('voice');
  const [domainProgress, setDomainProgress] = useState([]);
  const [compileUnlocked, setCompileUnlocked] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [mcqOptions, setMcqOptions] = useState(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);

  useEffect(() => {
    fetch('/api/providers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setAvailableProviders(data);
        // Auto-select first available provider
        const first = ['anthropic', 'openai', 'gemini'].find((p) => data[p]);
        if (first) setProvider(first);
      })
      .catch(() => {
        // If endpoint fails, assume anthropic only
        setAvailableProviders({ anthropic: true, openai: false, gemini: false });
      });
  }, []);

  async function startInterview() {
    await fetch('/api/session/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ domainType }),
    });
    setPhase('interview');
    sendMessage('Ready.');
  }

  function extractMCQOptions(text) {
    const matches = [...text.matchAll(/^([A-D])\)\s*(.+)/gm)];
    if (matches.length >= 2) return matches.map((m) => ({ letter: m[1], text: m[2].trim() }));
    return null;
  }

  async function sendMessage(text) {
    if (isStreaming) return;
    setMcqOptions(null);

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setStreamingContent('');
    setIsStreaming(true);

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: text, provider }),
    });

    if (!response.ok) {
      let detail = 'Could not reach the server.';
      try {
        const body = await response.json();
        if (body.error) detail = body.error;
      } catch { /* ignore */ }
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `[SERVER · ${response.status}] ${detail} Your progress up to this point is intact — refresh and try again.` },
      ]);
      setIsStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.text) {
              accumulated += event.text;
              setStreamingContent(accumulated);
            }

            if (event.domain) {
              const d = event.domain;
              if (d === 'complete') {
                setDomainProgress(DOMAIN_ORDER.slice(0, -1));
                setCurrentDomain('complete');
              } else if (d === 'warmup') {
                setCurrentDomain('warmup');
              } else {
                setCurrentDomain(d);
                setDomainProgress((prev) => {
                  const idx = DOMAIN_ORDER.indexOf(d);
                  const completed = DOMAIN_ORDER.slice(0, idx);
                  return [...new Set([...prev, ...completed])];
                });
              }
            }

            if (event.done) {
              if (event.compileUnlocked) setCompileUnlocked(true);
              setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: accumulated },
              ]);
              setStreamingContent('');
              setIsStreaming(false);
              setMcqOptions(extractMCQOptions(accumulated));
            }

            if (event.error) {
              if (accumulated) {
                setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
              }
              setMessages((prev) => [...prev, { role: 'system', content: event.error }]);
              setStreamingContent('');
              setIsStreaming(false);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (networkErr) {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `[NETWORK · CONNECTION LOST] The stream was interrupted before the response completed. Your conversation up to the previous message is intact. Check your connection and try again.` },
      ]);
      setStreamingContent('');
      setIsStreaming(false);
    }
  }

  async function handleCompile() {
    if (!compileUnlocked || isCompiling) return;
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Compile failed' }));
        throw new Error(error);
      }
      const { persona, aboutMe } = await res.json();
      navigate('/preview', { state: { persona, aboutMe } });
    } catch (err) {
      alert('Compilation failed: ' + err.message);
      setIsCompiling(false);
    }
  }

  if (phase === 'select') {
    const loading = availableProviders === null;
    const availableCount = availableProviders
      ? Object.values(availableProviders).filter(Boolean).length
      : 0;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '28px',
          padding: '40px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'monospace',
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#00ff88',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}
          >
            PersonaMirror
          </h1>
          <p style={{ color: '#666', fontSize: '14px' }}>
            An identity interview. 25–40 questions. No right answers.
          </p>
        </div>

        {/* Provider warning */}
        {!loading && availableCount < 2 && (
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '10px 14px',
              borderRadius: '7px',
              background: '#1a1000',
              border: '1px solid #ffaa0050',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#ffaa00',
              lineHeight: '1.6',
            }}
          >
            {availableCount === 0 ? (
              <>
                <strong>⚠ No providers configured.</strong> Set at least one API key in <code>server/.env</code> before starting.
              </>
            ) : (
              <>
                <strong>⚠ Only 1 provider configured.</strong> If it hits a rate limit mid-interview, the session will fail with no fallback. Add a second API key in <code>server/.env</code> for reliability.
              </>
            )}
          </div>
        )}

        {/* Provider selector */}
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#888',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}
          >
            AI Provider
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['anthropic', 'openai', 'gemini'].map((p) => {
              const meta = PROVIDER_META[p];
              const available = loading ? false : (availableProviders[p] ?? false);
              const selected = provider === p;
              return (
                <button
                  key={p}
                  onClick={() => available && setProvider(p)}
                  disabled={!available}
                  title={!available ? 'API key not configured' : undefined}
                  style={{
                    flex: 1,
                    padding: '12px 10px',
                    borderRadius: '8px',
                    border: selected
                      ? `1px solid ${meta.color}80`
                      : '1px solid #222',
                    background: selected ? `${meta.color}12` : '#111',
                    color: available ? '#e0e0e0' : '#3a3a3a',
                    cursor: available ? 'pointer' : 'not-allowed',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    opacity: available ? 1 : 0.45,
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: selected ? meta.color : '#333',
                      margin: '0 auto 8px',
                      transition: 'background 0.15s',
                    }}
                  />
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold' }}>
                    {meta.label}
                  </div>
                  <div style={{ fontSize: '11px', color: available ? '#555' : '#2a2a2a', marginTop: '3px' }}>
                    {available ? meta.model : 'key missing'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Domain type selector */}
        <div
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '10px',
            padding: '24px 28px',
            width: '100%',
            maxWidth: '440px',
          }}
        >
          <p
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#888',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            Context
          </p>
          {[
            { value: 'general',       label: 'General',       desc: 'Everyday work and decisions' },
            { value: 'coding',        label: 'Engineering',   desc: 'Code, architecture, tools' },
            { value: 'writing',       label: 'Writing',       desc: 'Drafting, editing, publishing' },
            { value: 'communication', label: 'Communication', desc: 'Management, meetings, feedback' },
          ].map(({ value, label, desc }) => (
            <label
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                marginBottom: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: domainType === value ? '#0d2a1a' : 'transparent',
                border: `1px solid ${domainType === value ? '#00ff8840' : 'transparent'}`,
                transition: 'all 0.1s',
              }}
            >
              <input
                type="radio"
                name="domainType"
                value={value}
                checked={domainType === value}
                onChange={() => setDomainType(value)}
                style={{ accentColor: '#00ff88' }}
              />
              <span>
                <span style={{ color: '#e0e0e0', fontSize: '14px' }}>{label}</span>
                <span style={{ color: '#555', fontSize: '12px', marginLeft: '8px' }}>{desc}</span>
              </span>
            </label>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            padding: '16px',
            borderRadius: '8px',
            background: '#0e0e0e',
            border: '1px solid #2a2a2a',
          }}
        >
          <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#555', lineHeight: '1.7', margin: '0 0 12px 0' }}>
            <span style={{ color: '#888' }}>Before you begin:</span>
            {' '}PersonaMirror does not store, transmit, or retain any of your answers or compiled persona data. Everything lives in server memory for the duration of your session and is permanently deleted when you close the tab, the session expires, or compilation completes.{' '}
            <br /><br />
            The persona file you download is your responsibility. We are not liable for how it is used, shared, or applied — including use by third parties or in automated systems.
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={disclaimerAcknowledged}
              onChange={(e) => setDisclaimerAcknowledged(e.target.checked)}
              style={{ accentColor: '#00ff88', marginTop: '2px', flexShrink: 0 }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666', lineHeight: '1.6' }}>
              I understand that no data is saved and that I am responsible for my persona file.
            </span>
          </label>
        </div>

        <button
          onClick={startInterview}
          disabled={loading || !availableProviders?.[provider] || !disclaimerAcknowledged}
          style={{
            background: loading || !availableProviders?.[provider] || !disclaimerAcknowledged ? '#1a1a1a' : '#00ff88',
            color: loading || !availableProviders?.[provider] || !disclaimerAcknowledged ? '#444' : '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 40px',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '0.05em',
            cursor: loading || !availableProviders?.[provider] || !disclaimerAcknowledged ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Loading…' : 'Begin Interview'}
        </button>
      </div>
    );
  }

  const providerMeta = PROVIDER_META[provider];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#00ff88',
              fontWeight: 'bold',
              letterSpacing: '0.05em',
            }}
          >
            PersonaMirror
          </span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              color: providerMeta.color,
              border: `1px solid ${providerMeta.color}40`,
              borderRadius: '3px',
              padding: '1px 6px',
              background: `${providerMeta.color}0a`,
            }}
          >
            {providerMeta.label}
          </span>
        </div>
        <DomainBadge domain={currentDomain} />
        {compileUnlocked && (
          <button
            onClick={handleCompile}
            disabled={isCompiling}
            style={{
              background: isCompiling ? '#1a1a1a' : '#00ff88',
              color: isCompiling ? '#444' : '#000',
              border: 'none',
              borderRadius: '5px',
              padding: '6px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 'bold',
              letterSpacing: '0.05em',
              cursor: isCompiling ? 'not-allowed' : 'pointer',
            }}
          >
            {isCompiling ? 'Compiling…' : 'Compile Persona'}
          </button>
        )}
      </div>

      <ProgressBar domainProgress={domainProgress} currentDomain={currentDomain} />

      <ChatWindow
        messages={messages}
        streamingContent={streamingContent}
        onSend={sendMessage}
        disabled={isStreaming || isCompiling}
        useWhisper={availableProviders?.openai === true}
        mcqOptions={mcqOptions}
        onSelectMCQ={(letter) => sendMessage(letter)}
      />
    </div>
  );
}
