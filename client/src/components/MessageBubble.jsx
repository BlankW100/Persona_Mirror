export default function MessageBubble({ role, content, isStreaming }) {
  const isUser = role === 'user';

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
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? '#0d2a1a' : '#161616',
          border: isUser ? '1px solid #00ff8830' : '1px solid #262626',
          fontFamily: isUser ? 'system-ui, sans-serif' : 'monospace',
          fontSize: isUser ? '14px' : '13px',
          lineHeight: '1.6',
          color: isUser ? '#c8f5df' : '#d4d4d4',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
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
