import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function PreviewPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const persona = state?.persona || '';
  const aboutMe = state?.aboutMe || '';
  const [tab, setTab] = useState('aboutMe');

  const content = tab === 'aboutMe' ? aboutMe : persona;

  function handleDownload() {
    const ext = tab === 'aboutMe' ? 'md' : 'xml';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persona.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!persona && !aboutMe) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '16px',
        }}
      >
        <p style={{ color: '#666', fontFamily: 'monospace' }}>No persona data. Run an interview first.</p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: '#00ff88',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '10px 24px',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Start Interview
        </button>
      </div>
    );
  }

  const tabs = [
    { key: 'aboutMe', label: 'persona.md', hint: 'Paste into any AI as system context' },
    { key: 'analysis', label: 'analysis.xml', hint: 'Forensic interview breakdown' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        padding: '32px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'monospace',
              fontSize: '20px',
              color: '#00ff88',
              letterSpacing: '0.05em',
            }}
          >
            PersonaMirror
          </h1>
          <p style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>
            Your persona document. Keep this private.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #333',
              borderRadius: '5px',
              padding: '8px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            New Interview
          </button>
          <button
            onClick={handleDownload}
            style={{
              background: '#00ff88',
              color: '#000',
              border: 'none',
              borderRadius: '5px',
              padding: '8px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Download .{tab === 'aboutMe' ? 'md' : 'xml'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #1e1e1e',
          marginBottom: '0',
        }}
      >
        {tabs.map(({ key, label, hint }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#00ff88' : 'transparent'}`,
              color: tab === key ? '#e0e0e0' : '#444',
              fontFamily: 'monospace',
              fontSize: '12px',
              padding: '10px 20px',
              cursor: 'pointer',
              transition: 'all 0.12s',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontWeight: tab === key ? 'bold' : 'normal' }}>{label}</span>
            <span
              style={{
                color: tab === key ? '#555' : '#333',
                fontSize: '10px',
                letterSpacing: '0.02em',
              }}
            >
              {hint}
            </span>
          </button>
        ))}
      </div>

      {/* Usage hint for persona.md tab */}
      {tab === 'aboutMe' && (
        <div
          style={{
            padding: '10px 16px',
            background: '#0d2a1a',
            border: '1px solid #00ff8820',
            borderTop: 'none',
            borderBottom: 'none',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#00ff8877',
            letterSpacing: '0.04em',
          }}
        >
          Copy the contents below and paste as the system prompt in Claude, ChatGPT, or Gemini to make it write and decide more like you.
        </div>
      )}

      {/* Content */}
      <pre
        style={{
          background: '#0a0a0a',
          border: '1px solid #1e1e1e',
          borderTop: tab === 'analysis' ? '1px solid #1e1e1e' : 'none',
          borderRadius: tab === 'analysis' ? '0 0 8px 8px' : '0 0 8px 8px',
          padding: '24px',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.7',
          color: '#c8c8c8',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          flex: 1,
          marginTop: 0,
        }}
      >
        {content || '(empty)'}
      </pre>
    </div>
  );
}
