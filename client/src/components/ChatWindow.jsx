import { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';

export default function ChatWindow({ messages, streamingContent, onSend, disabled }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !disabled && input.trim()) {
      e.preventDefault();
      onSend(input.trim());
      setInput('');
    }
  }

  function handleSend() {
    if (!disabled && input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 0',
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a2a transparent',
        }}
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}
        {streamingContent && (
          <MessageBubble role="assistant" content={streamingContent} isStreaming />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid #1e1e1e',
          padding: '12px 16px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type your answer… (Enter to send)"
          rows={2}
          style={{
            flex: 1,
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '6px',
            color: '#e0e0e0',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '8px 12px',
            resize: 'none',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#00ff8860')}
          onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          style={{
            background: disabled || !input.trim() ? '#1a1a1a' : '#00ff88',
            color: disabled || !input.trim() ? '#444' : '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 18px',
            fontFamily: 'monospace',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
            height: '38px',
            transition: 'all 0.15s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
