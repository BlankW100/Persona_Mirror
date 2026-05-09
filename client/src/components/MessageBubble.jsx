function parseInline(text, keyPrefix) {
  const segments = [];
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        <span key={`${keyPrefix}-t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }
    const raw = match[0];
    if (raw.startsWith('**')) {
      segments.push(<strong key={`${keyPrefix}-b${match.index}`}>{raw.slice(2, -2)}</strong>);
    } else {
      segments.push(<em key={`${keyPrefix}-i${match.index}`}>{raw.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(
      <span key={`${keyPrefix}-t${lastIndex}`}>{text.slice(lastIndex)}</span>
    );
  }

  return segments.length > 0 ? segments : text;
}

function renderMarkdown(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.trim() === '') {
      return <div key={i} style={{ height: '0.5em' }} />;
    }
    if (line.startsWith('> ')) {
      return (
        <div
          key={i}
          style={{
            borderLeft: '2px solid #00ff8850',
            paddingLeft: '10px',
            color: '#a0c0a8',
            fontStyle: 'italic',
            margin: '4px 0',
          }}
        >
          {parseInline(line.slice(2), `L${i}`)}
        </div>
      );
    }
    return <div key={i}>{parseInline(line, `L${i}`)}</div>;
  });
}

export default function MessageBubble({ role, content, isStreaming }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

  if (isSystem) {
    return (
      <div style={{ padding: '0 16px', marginBottom: '12px' }}>
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#1a1200',
            border: '1px solid #ffaa0040',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            color: '#ffcc44',
            wordBreak: 'break-word',
          }}
        >
          <div style={{ fontSize: '10px', color: '#ffaa0088', letterSpacing: '0.1em', marginBottom: '6px' }}>
            SYSTEM
          </div>
          {renderMarkdown(content)}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          maxWidth: '72%',
          padding: '12px 16px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? '#0d2a1a' : '#161616',
          border: isUser ? '1px solid #00ff8830' : '1px solid #262626',
          fontFamily: isUser ? 'system-ui, sans-serif' : 'monospace',
          fontSize: isUser ? '14px' : '13px',
          lineHeight: '1.7',
          color: isUser ? '#c8f5df' : '#d4d4d4',
          whiteSpace: isUser ? 'pre-wrap' : 'normal',
          wordBreak: 'break-word',
        }}
      >
        {isUser ? content : renderMarkdown(content)}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '7px',
              height: '13px',
              background: '#00ff88',
              marginLeft: '3px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
