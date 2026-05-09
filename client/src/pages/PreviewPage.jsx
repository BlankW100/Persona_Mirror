import { useLocation, useNavigate } from 'react-router-dom';

export default function PreviewPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const persona = state?.persona || '';

  function handleDownload() {
    const blob = new Blob([persona], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'persona.xml';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!persona) {
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
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
            Persona Document
          </h1>
          <p style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>
            Generated from your interview. Keep this private.
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
            Download .xml
          </button>
        </div>
      </div>

      <pre
        style={{
          background: '#0a0a0a',
          border: '1px solid #1e1e1e',
          borderRadius: '8px',
          padding: '24px',
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.7',
          color: '#c8c8c8',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          flex: 1,
        }}
      >
        {persona}
      </pre>
    </div>
  );
}
