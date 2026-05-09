# Requirements

Everything needed to install, configure, and run PersonaMirror locally.

---

## System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| Node.js | 18.x | 22.x |
| npm | 9.x | 10.x |
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Any modern OS |
| RAM | 512 MB free | 1 GB+ |
| Browser | Chrome 90+, Edge 90+ | Chrome or Edge (required for Web Speech API) |
| Internet | Required | Stable connection |

---

## API Keys

At least one LLM provider key is required to run the application. Keys are never sent to the client — all API calls are made server-side.

### LLM Providers (pick at least one)

| Provider | Key name | Model used | Where to get it |
|---|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-6 | console.anthropic.com |
| OpenAI | `OPENAI_API_KEY` | gpt-4o | platform.openai.com |
| Google | `GEMINI_API_KEY` | gemini-2.5-flash | aistudio.google.com |

### Voice Transcription (optional but recommended)

| Feature | Key required | Notes |
|---|---|---|
| Whisper voice input | `OPENAI_API_KEY` | Falls back to browser Web Speech API if not configured |

If `OPENAI_API_KEY` is not set, voice input uses the browser's built-in Web Speech API. This works in Chrome and Edge but not in Firefox or Safari. Whisper is more accurate and language-agnostic.

---

## Environment Variables

Create `server/.env` by copying the template:

```bash
cp .env.example server/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | No* | — | Enables Anthropic Claude as a provider |
| `OPENAI_API_KEY` | No* | — | Enables OpenAI GPT-4o + Whisper voice input |
| `GEMINI_API_KEY` | No* | — | Enables Google Gemini as a provider |
| `PORT` | No | 3001 | Server port |
| `SESSION_SECRET` | Yes | — | Random string used to sign session cookies |

\* At least one LLM key is required. The application shows only providers with valid keys configured.

**Example `server/.env`:**

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
PORT=3001
SESSION_SECRET=replace-this-with-something-random
```

---

## Server Dependencies

Installed via `cd server && npm install`

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.21.2 | HTTP server framework |
| `cors` | ^2.8.5 | Cross-origin request handling (Vite ↔ Express) |
| `express-session` | ^1.18.0 | Session middleware |
| `memorystore` | ^1.6.7 | In-memory session store (no database needed) |
| `multer` | ^2.1.1 | Multipart file upload handling (voice audio) |
| `dotenv` | ^16.4.5 | Load environment variables from `.env` |
| `@anthropic-ai/sdk` | ^0.52.0 | Anthropic Claude API client |
| `openai` | ^6.37.0 | OpenAI GPT-4o + Whisper API client |
| `@google/generative-ai` | ^0.24.1 | Google Gemini API client |

---

## Client Dependencies

Installed via `cd client && npm install`

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.28.0 | Client-side routing |
| `vite` | ^6.0.5 | Development server + build tool |
| `@vitejs/plugin-react` | ^4.3.4 | React JSX transform for Vite |

No external UI libraries. No CSS frameworks. All styling is inline.

---

## Ports

| Service | Default port | Configurable |
|---|---|---|
| Express server | 3001 | Yes — set `PORT` in `server/.env` |
| Vite dev server | 5173 | Yes — set in `client/vite.config.js` |

The Vite config proxies all `/api/*` requests to `http://localhost:3001`. If you change the server port, update `client/vite.config.js` to match.

---

## Network Requirements

The application makes outbound HTTPS calls to the following endpoints during runtime:

| Endpoint | When | Provider |
|---|---|---|
| `api.anthropic.com` | Chat streaming | Anthropic |
| `api.openai.com` | Chat streaming + voice transcription | OpenAI |
| `generativelanguage.googleapis.com` | Chat streaming | Google |

All calls are server-to-API. The browser never contacts LLM providers directly.

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Core interview | ✓ | ✓ | ✓ | ✓ |
| MCQ buttons | ✓ | ✓ | ✓ | ✓ |
| Whisper voice input | ✓ | ✓ | ✓ | ✓ |
| Web Speech API (fallback) | ✓ | ✓ | ✗ | Partial |
| SSE streaming | ✓ | ✓ | ✓ | ✓ |

Chrome or Edge recommended for full feature support including the Web Speech API fallback.

---

## Session Behavior

- Sessions are stored in server memory (no database)
- Sessions expire after **30 minutes** of inactivity
- Session is destroyed after persona compilation completes
- Refreshing the browser mid-interview does not resume the session — the interview must be restarted
- Maximum one active session per browser tab (sessions are cookie-based)

---

## Known Constraints

**No persistence** — Interview transcripts are not saved to disk. If the server restarts mid-interview, the session is lost. The compiled outputs (persona.md and analysis.xml) must be downloaded before leaving the preview page.

**In-memory only** — All session data lives in RAM. For production use, swap `memorystore` for a Redis-backed session store and add proper persistence.

**Single-user design** — There is no authentication. Anyone with access to the running server can start an interview. For multi-user or shared deployments, add auth middleware.

**OpenAI key required for Whisper** — Voice transcription via Whisper uses `openai` even if the selected chat provider is Anthropic or Gemini. The two are independent.
