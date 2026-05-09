import { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export default function ChatWindow({ messages, streamingContent, onSend, disabled, useWhisper, mcqOptions, onSelectMCQ }) {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hoveredMCQ, setHoveredMCQ] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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

  // ── Web Speech API (browser-native, real-time) ──────────────────────────────

  function startWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Disable profanity filter where the browser supports it (Chrome-specific)
    try { recognition.profanityFilter = false; } catch (_) {}

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += chunk + ' ';
        } else {
          interim += chunk;
        }
      }
      setInput(finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') console.error('STT error:', event.error);
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      setInput((prev) => prev.trim());
      // Re-focus textarea so Enter-to-send still works
      textareaRef.current?.focus();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function stopWebSpeech() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  // ── Whisper (server-side via OpenAI, handles all language including profanity) ─

  async function startWhisper() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone access denied. Allow microphone access in your browser settings.');
      } else {
        console.error('Microphone error:', err);
      }
      return;
    }

    audioChunksRef.current = [];

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      .find((t) => MediaRecorder.isTypeSupported(t)) || '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });

      setIsTranscribing(true);
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: 'Transcription failed' }));
          throw new Error(error);
        }

        const { text } = await res.json();
        if (text) {
          setInput((prev) => (prev ? prev.trimEnd() + ' ' + text : text));
          textareaRef.current?.focus();
        }
      } catch (err) {
        console.error('Whisper transcription error:', err.message);
      } finally {
        setIsTranscribing(false);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopWhisper() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  // ── Unified toggle ──────────────────────────────────────────────────────────

  function toggleRecording() {
    if (isRecording) {
      if (useWhisper) stopWhisper();
      else stopWebSpeech();
    } else {
      if (useWhisper) startWhisper();
      else startWebSpeech();
    }
  }

  const micDisabled = disabled || isTranscribing;
  const modeLabel = useWhisper ? 'Whisper' : 'Browser';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(255,51,102,0.4); }
          70% { box-shadow: 0 0 0 6px rgba(255,51,102,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,51,102,0); }
        }
      `}</style>

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
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {mcqOptions ? (
          /* ── MCQ mode: clickable option buttons, no text input ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mcqOptions.map(({ letter, text }) => {
              const isHovered = hoveredMCQ === letter;
              return (
                <button
                  key={letter}
                  onClick={() => !disabled && onSelectMCQ(letter)}
                  disabled={disabled}
                  onMouseEnter={() => setHoveredMCQ(letter)}
                  onMouseLeave={() => setHoveredMCQ(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    background: isHovered ? '#0d2a1a' : '#111',
                    border: `1px solid ${isHovered ? '#00ff8860' : '#222'}`,
                    borderRadius: '7px',
                    color: disabled ? '#444' : '#d4d4d4',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    transition: 'all 0.12s',
                    width: '100%',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: isHovered ? '#00ff88' : '#555',
                      minWidth: '18px',
                      transition: 'color 0.12s',
                    }}
                  >
                    {letter}
                  </span>
                  {text}
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Open question mode: textarea + mic + send ── */
          <>
            {(isRecording || isTranscribing) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: isTranscribing ? '#888' : '#ff3366',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isTranscribing ? '#555' : '#ff3366',
                    display: 'inline-block',
                    animation: isRecording ? 'blink 1s step-end infinite' : 'none',
                  }}
                />
                {isTranscribing
                  ? 'Transcribing…'
                  : `Listening via ${modeLabel} — click ■ to stop`}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={
                  isRecording ? 'Speak now…' : isTranscribing ? 'Transcribing…' : 'Type your answer… (Enter to send)'
                }
                rows={2}
                style={{
                  flex: 1,
                  background: isRecording ? '#1a0a0e' : '#111',
                  border: `1px solid ${isRecording ? '#ff336640' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  padding: '8px 12px',
                  resize: 'none',
                  outline: 'none',
                  transition: 'all 0.15s',
                }}
                onFocus={(e) => { if (!isRecording) e.target.style.borderColor = '#00ff8860'; }}
                onBlur={(e) => { if (!isRecording) e.target.style.borderColor = '#2a2a2a'; }}
              />

              <button
                onClick={toggleRecording}
                disabled={micDisabled}
                title={
                  isTranscribing ? 'Transcribing…'
                  : isRecording ? `Stop recording (${modeLabel})`
                  : `Start voice input (${modeLabel})`
                }
                style={{
                  background: isRecording ? '#ff3366' : '#1a1a1a',
                  color: isRecording ? '#fff' : micDisabled ? '#333' : '#888',
                  border: `1px solid ${isRecording ? '#ff336660' : '#2a2a2a'}`,
                  borderRadius: '6px',
                  padding: '8px 11px',
                  cursor: micDisabled ? 'not-allowed' : 'pointer',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  animation: isRecording ? 'pulse-ring 1.5s ease-out infinite' : 'none',
                  flexShrink: 0,
                }}
              >
                {isRecording ? <StopIcon /> : <MicIcon />}
              </button>

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
                  flexShrink: 0,
                }}
              >
                Send
              </button>
            </div>

            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#333', letterSpacing: '0.05em' }}>
              STT: {useWhisper ? 'Whisper (OpenAI)' : 'Browser API — set OPENAI_API_KEY for Whisper'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
