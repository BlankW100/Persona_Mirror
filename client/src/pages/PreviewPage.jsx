import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import JSZip from 'jszip';

export default function PreviewPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const forensicXml = state?.persona || '';
  const personaMd = state?.aboutMe || '';
  const skills = state?.skills || [];
  const skillsJson = state?.skillsJson || [];
  const manualMd = state?.manualMd || '';

  const allTabs = [
    {
      key: 'aboutMe',
      label: 'persona.md',
      hint: 'Paste into any AI as system context',
      content: personaMd,
      filename: 'persona.md',
    },
    {
      key: 'analysis',
      label: 'analysis.xml',
      hint: 'Forensic interview breakdown',
      content: forensicXml,
      filename: 'analysis.xml',
    },
    ...skills.map((s) => ({
      key: `skill_${s.name}`,
      label: `SKILL_${s.name}.md`,
      hint: 'Agent skill definition',
      content: s.skillMd || '',
      filename: `SKILL_${s.name}.md`,
    })),
    ...(skillsJson.length > 0
      ? [{
          key: 'skillsJson',
          label: 'skills.json',
          hint: 'Paste into API tools[] array',
          content: JSON.stringify(skillsJson, null, 2),
          filename: 'skills.json',
        }]
      : []),
    ...(manualMd
      ? [{
          key: 'manual',
          label: 'manual.md',
          hint: 'Usage guide for human and AI',
          content: manualMd,
          filename: 'manual.md',
        }]
      : []),
  ];

  const [tab, setTab] = useState('aboutMe');

  const activeTab = allTabs.find((t) => t.key === tab) || allTabs[0];

  function handleDownload() {
    if (!activeTab) return;
    const blob = new Blob([activeTab.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadAll() {
    const zip = new JSZip();
    zip.file('persona.md', personaMd);
    if (skills.length > 0) {
      const skillsFolder = zip.folder('skills');
      skills.forEach((s) => {
        skillsFolder.file(`SKILL_${s.name}.md`, s.skillMd || '');
      });
    }
    if (skillsJson.length > 0) {
      zip.file('skills.json', JSON.stringify(skillsJson, null, 2));
    }
    if (manualMd) {
      zip.file('manual.md', manualMd);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'persona_bundle.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasBundle = skills.length > 0 || manualMd;

  if (!forensicXml && !personaMd) {
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
            Your persona bundle. Keep this private — this page will not be available after you leave.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
          {hasBundle && (
            <button
              onClick={handleDownloadAll}
              style={{
                background: 'transparent',
                color: '#00ff88',
                border: '1px solid #00ff8840',
                borderRadius: '5px',
                padding: '8px 16px',
                fontFamily: 'monospace',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Download .zip
            </button>
          )}
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
            Download {activeTab?.filename || 'file'}
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
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {allTabs.map(({ key, label, hint }) => (
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
              whiteSpace: 'nowrap',
              flexShrink: 0,
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

      {/* Per-tab usage hint */}
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
      {tab === 'skillsJson' && (
        <div
          style={{
            padding: '10px 16px',
            background: '#0d1a2a',
            border: '1px solid #4488ff20',
            borderTop: 'none',
            borderBottom: 'none',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#4488ff77',
            letterSpacing: '0.04em',
          }}
        >
          Paste this array as the <code>tools</code> parameter in any Anthropic, OpenAI, or compatible API call.
        </div>
      )}
      {tab === 'manual' && (
        <div
          style={{
            padding: '10px 16px',
            background: '#1a1a0d',
            border: '1px solid #ffaa0020',
            borderTop: 'none',
            borderBottom: 'none',
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#ffaa0077',
            letterSpacing: '0.04em',
          }}
        >
          Usage instructions for you (the human) and the AI agent that will use this persona.
        </div>
      )}

      {/* Content */}
      <pre
        style={{
          background: '#0a0a0a',
          border: '1px solid #1e1e1e',
          borderTop: (tab === 'analysis' || tab.startsWith('skill_')) ? '1px solid #1e1e1e' : 'none',
          borderRadius: '0 0 8px 8px',
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
        {activeTab?.content || '(empty)'}
      </pre>
    </div>
  );
}
