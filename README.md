# PersonaMirror

PersonaMirror is an AI-powered identity interview platform. It runs a structured behavioral interview, then compiles the transcript into a reusable **persona file** — a document you can paste into any AI system to make it write, decide, and respond more like a specific person.

---

## What It Does

1. **Interviews the user** across five behavioral domains: Voice, Beliefs, Decisions, Conflict, and Taste
2. **Compiles the transcript** into two outputs:
   - `persona.md` — a compact profile ready to paste as an AI system prompt
   - `analysis.xml` — a forensic breakdown with confidence scores, behavioral cluster, and contradiction flags
3. **Lets you download** either output for use in other AI tools

The interview is conversational. The science layer (OCEAN personality mapping, situational judgment probes, behavioral inference) runs invisibly underneath — the user just talks.

---

## How to Run

### Prerequisites

- Node.js 18 or later
- At least one LLM API key (see [Requirements](REQUIREMENTS.md))

### 1. Clone the repo

```bash
git clone https://github.com/BlankW100/Persona_Mirror.git
cd Persona_Mirror
```

### 2. Configure environment variables

```bash
cp .env.example server/.env
```

Open `server/.env` and fill in your API keys:

```
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
SESSION_SECRET=any-random-string
PORT=3001
```

You only need keys for the providers you want to use. At least one is required. `OPENAI_API_KEY` is also needed for voice-to-text (Whisper).

### 3. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 4. Start the server and client

Open two terminals:

**Terminal 1 — Server:**
```bash
cd server && npm run dev
```

**Terminal 2 — Client:**
```bash
cd client && npm run dev
```

Open your browser to `http://localhost:5173`

---

## Application Flow

### Step 1 — Select Provider and Domain

On the landing screen, choose:
- **AI Provider**: Anthropic (Claude), OpenAI (GPT-4o), or Google (Gemini). Only providers with configured API keys appear as available.
- **Domain**: General, Engineering, Writing, or Communication. This tailors the interview questions to a context.

Click **Begin Interview**.

### Step 2 — Warmup (12 MCQs)

The interview starts with 12 multiple-choice questions. These are not personality-test items — they are behavioral calibration questions mapped to OCEAN dimensions internally. The user clicks a lettered option. No follow-up is asked on MCQs.

### Step 3 — Five Domain Phases

After warmup, the AI moves through five open-ended phases:

| Phase | What It Extracts |
|---|---|
| **Voice** | Communication style, register, phrase bank, writing laws |
| **Beliefs** | Operative convictions, contrarian positions, changed minds |
| **Decisions** | Risk tolerance, completeness drive, sunk-cost behavior |
| **Conflict** | Threshold, engagement style, triggers, concession pattern |
| **Taste** | Aesthetic loves and disgusts, hard refusals, specific examples |

Each phase also includes **micro-detail questions** scattered naturally — small personal questions (swearing register, texting style, morning/night preference, workspace habits) that build a behavioral cluster used by the compression engine.

If an answer is vague, the AI uses a **behavioral probe** (a situational judgment test scenario) to get a more specific signal. It does this once and moves on.

The progress bar across the top tracks completed domains.

### Step 4 — Compile Persona

When the interview completes, the **Compile Persona** button activates. Click it. The server runs two stages:

1. **Compression** — The raw transcript is turned into a detailed forensic XML document. This includes voice fingerprint, beliefs, decision heuristics, conflict signature, taste profile, hard refusals, phrase bank, golden examples, productive contradictions, and confidence scores per domain.

2. **Distillation** — The forensic XML is compressed into a token-optimized `about_me` profile (2,000–5,000 tokens). Every line passes the test: "If this line disappeared, would an AI write differently?"

### Step 5 — Review and Download

The results page shows two tabs:

- **persona.md** — The distilled profile. Copy and paste this as a system prompt into any AI tool.
- **analysis.xml** — The full forensic breakdown. Useful for inspection, debugging, or downstream processing.

Download either file using the button in the top-right corner.

---

## Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│          CLIENT (React)         │     │          SERVER (Express)         │
│                                 │     │                                  │
│  InterviewPage                  │────▶│  POST /api/session/init          │
│    └─ Provider/Domain select    │     │  POST /api/chat (SSE streaming)  │
│    └─ ChatWindow                │◀────│  POST /api/compile               │
│         └─ MessageBubble        │     │  POST /api/transcribe (Whisper)  │
│         └─ MCQ buttons          │     │                                  │
│    └─ ProgressBar               │     │  providers/index.js              │
│    └─ DomainBadge               │     │    └─ Anthropic / OpenAI / Gemini│
│                                 │     │                                  │
│  PreviewPage                    │     │  prompts/                        │
│    └─ persona.md tab            │     │    └─ elicitation.js (interview) │
│    └─ analysis.xml tab          │     │    └─ compression.js (forensic)  │
│    └─ Download button           │     │    └─ distillation.js (compact)  │
└─────────────────────────────────┘     └──────────────────────────────────┘
```

### Key Design Decisions

**Domain tokens in output** — The AI embeds `[DOMAIN:warmup]`, `[DOMAIN:voice]` etc. directly in its streamed response. The client strips these out and uses them to update the progress bar and current domain badge, without a separate API call.

**Two-stage compilation** — Compression preserves full fidelity (forensic XML with confidence metadata). Distillation then optimizes for token efficiency. Separating the two stages means the forensic data is always available for inspection even if the distilled output is adjusted.

**Provider abstraction** — A single `streamChat()` and `generateText()` interface normalizes the three different LLM SDKs. You can switch providers mid-interview without any other code changes.

**Session-based transcript storage** — The full conversation lives in server-side Express sessions (in-memory, 30-minute expiry). No database is required. The session is destroyed after compilation completes.

**Client-side MCQ detection** — The server outputs plain text. The client scans each message for lines matching `A) ... B) ... C) ... D)` and renders them as clickable buttons. This keeps the server stateless with respect to UI format.

---

## Voice Input

Two modes are available automatically:

| Mode | When active | How it works |
|---|---|---|
| **Whisper** | `OPENAI_API_KEY` is configured | Records audio, uploads to OpenAI Whisper, returns accurate transcript |
| **Web Speech** | No OpenAI key | Uses browser-native real-time speech recognition, no server calls |

Both modes preserve filler words, profanity, and natural speech patterns — which is intentional. The behavioral signal from *how* someone talks is part of the signal being captured.

---

## Project Structure

```
Persona_Mirror/
├── server/
│   ├── index.js              Express entry point (port 3001)
│   ├── .env                  API keys (gitignored)
│   ├── routes/
│   │   ├── interview.js      SSE streaming chat
│   │   ├── compile.js        Two-stage persona generation
│   │   ├── session.js        Session init / state / reset
│   │   └── transcribe.js     Whisper audio transcription
│   ├── providers/
│   │   └── index.js          Unified LLM interface (Anthropic / OpenAI / Gemini)
│   └── prompts/
│       ├── elicitation.js    Full interview question framework
│       ├── compression.js    Forensic XML persona compiler
│       └── distillation.js   Token-optimized about_me generator
│
├── client/
│   └── src/
│       ├── App.jsx            Routes (/ and /preview)
│       ├── pages/
│       │   ├── InterviewPage.jsx   Interview UI and state
│       │   └── PreviewPage.jsx     Results and download
│       └── components/
│           ├── ChatWindow.jsx      Message stream + voice input + MCQ buttons
│           ├── MessageBubble.jsx   Markdown-rendering message display
│           ├── DomainBadge.jsx     Current phase pill indicator
│           └── ProgressBar.jsx     Five-domain completion tracker
│
├── .env.example              Environment variable template
├── README.md
└── REQUIREMENTS.md
```

---

## Troubleshooting

**Port 3001 already in use**
```bash
# Find and kill the process
netstat -ano | findstr :3001
# Then kill the PID shown
taskkill /PID <pid> /F
```

**No providers available on the selection screen**
Check that your API keys in `server/.env` are valid and the server has been restarted after editing the file.

**Voice input not working**
Whisper requires `OPENAI_API_KEY`. If not configured, the browser Web Speech API is used instead — make sure your browser supports it (Chrome / Edge work best).

**Compile button never appears**
The interview must reach `[DOMAIN:complete]` before the compile button unlocks. If the AI stops early, refresh and try again. Long silences or network drops can interrupt the SSE stream.
