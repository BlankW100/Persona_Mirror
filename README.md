# PersonaMirror

PersonaMirror is an AI-powered identity interview platform. It runs a structured behavioral interview, then compiles the transcript into a complete **agent bundle** — everything needed to deploy an AI that writes, decides, and responds like a specific person.

---

## What It Does

1. **Interviews the user** across five behavioral domains: Voice, Beliefs, Decisions, Conflict, and Taste
2. **Compiles the transcript** into a full agent bundle:
   - `persona.md` — a compact identity profile ready to paste as an AI system prompt
   - `SKILL_<name>.md` — one file per skill, defining callable actions grounded in the persona's behavioral patterns
   - `skills.json` — machine-readable Anthropic tool schemas, ready to paste into any API `tools[]` array
   - `manual.md` — usage guide with instructions for the human and inline instructions for the AI agent
   - `analysis.xml` — the full forensic breakdown with confidence scores, behavioral cluster, and contradiction flags
3. **Lets you download** individual files per tab, or the entire bundle as a `.zip`

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

When the interview completes, the **Compile Persona** button activates. Click it. The server runs five stages in sequence. The button label updates as each stage begins:

1. **Compression** — The raw transcript is turned into a detailed forensic XML document. This includes voice fingerprint, beliefs, decision heuristics, conflict signature, taste profile, hard refusals, phrase bank, golden examples, productive contradictions, and confidence scores per domain.

2. **Distillation** — The forensic XML is compressed into a token-optimized `persona.md` (2,000–5,000 tokens). Every line passes the test: "If this line disappeared, would an AI write differently?"

3. **Skill analysis** — The forensic XML is analyzed to identify 2–5 skills that would be genuinely useful for this specific persona. Each skill is grounded in a specific behavioral signal from the interview (e.g., a strong voice pattern drives a `write_in_voice` skill; a distinctive decision style drives an `evaluate_options` skill).

4. **Skill generation** — Each identified skill is built individually into a `SKILL_<name>.md` (step-by-step instructions for the agent) and a JSON tool schema (for API tool use). One LLM call per skill.

5. **Manual generation** — The persona.md and all skills are synthesized into a `manual.md` with two sections: instructions for the human (what each file is, how to use with Claude.ai or the API) and instructions for the AI agent (persona pasted inline, skills listed with trigger conditions).

Total compile time is typically 2–5 minutes depending on the number of skills and provider speed.

### Step 5 — Review and Download

The results page shows tabs for every file in the bundle. Tabs appear dynamically based on what the compile pipeline produced:

| Tab | Contents |
|---|---|
| **persona.md** | Distilled identity profile. Paste as a system prompt. |
| **SKILL_\<name\>.md** | One tab per skill. Human-readable definition with instructions, triggers, and examples. |
| **skills.json** | All tool schemas in a single array. Paste into any API `tools[]` parameter. |
| **manual.md** | Full usage guide for the human and the AI agent. |
| **analysis.xml** | Full forensic breakdown. Useful for inspection or debugging. |

Use the **Download \<filename\>** button to save the current tab, or **Download .zip** to get the entire bundle as a structured zip file:

```
persona.md
skills/
  SKILL_write_in_voice.md
  SKILL_evaluate_options.md
  ...
skills.json
manual.md
```

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
│    └─ SKILL_*.md tabs           │     │    └─ compression.js (forensic)  │
│    └─ skills.json tab           │     │    └─ distillation.js (persona)  │
│    └─ manual.md tab             │     │    └─ skill_analysis.js          │
│    └─ analysis.xml tab          │     │    └─ skill_schema.js            │
│    └─ Download / .zip buttons   │     │    └─ manual.js                  │
└─────────────────────────────────┘     └──────────────────────────────────┘
```

### Key Design Decisions

**Domain tokens in output** — The AI embeds `[DOMAIN:warmup]`, `[DOMAIN:voice]` etc. directly in its streamed response. The client strips these out and uses them to update the progress bar and current domain badge, without a separate API call.

**Five-stage compilation** — The pipeline runs in sequence: Compression (transcript → forensic XML) → Distillation (XML → persona.md) → Skill Analysis (XML → skill list) → Skill Generation (one call per skill → SKILL.md + tool schema) → Manual Generation (persona + skills → manual.md). Stages 3–5 are fault-tolerant: if skill generation fails, the compile still returns persona.md. Each stage is a separate LLM call, keeping prompts focused and outputs independently auditable.

**System prompt vs. skill separation** — persona.md defines *who the agent is* (identity, tone, values — always loaded). SKILL_*.md and skills.json define *what the agent does* (callable actions with inputs, outputs, and trigger conditions — invoked on demand). Mixing these concerns into a single document produces an agent that is harder to steer and harder to extend. The bundle keeps them separate so each can be updated independently.

**JSON-only structured outputs** — The skill analysis and skill schema stages instruct the model to return only parseable JSON. A `cleanJson()` helper strips markdown code fences that models sometimes emit despite instructions. All `JSON.parse()` calls are wrapped in try/catch with raw output logging so failures are debuggable without crashing the compile.

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
│   │   ├── compile.js        Five-stage persona + skill bundle generation
│   │   ├── session.js        Session init / state / reset
│   │   └── transcribe.js     Whisper audio transcription
│   ├── providers/
│   │   └── index.js          Unified LLM interface (Anthropic / OpenAI / Gemini)
│   └── prompts/
│       ├── elicitation.js    Full interview question framework
│       ├── compression.js    Forensic XML persona compiler
│       ├── distillation.js   Token-optimized persona.md generator
│       ├── skill_analysis.js Identifies 2–5 skills from forensic XML
│       ├── skill_schema.js   Generates SKILL.md + tool schema per skill
│       └── manual.js         Generates usage manual for human + AI agent
│
├── client/
│   └── src/
│       ├── App.jsx            Routes (/ and /preview)
│       ├── pages/
│       │   ├── InterviewPage.jsx   Interview UI, state, and step-progress compile
│       │   └── PreviewPage.jsx     Dynamic tabs, per-file download, zip export
│       └── components/
│           ├── ChatWindow.jsx      Message stream + voice input + MCQ buttons
│           ├── MessageBubble.jsx   Markdown-rendering message display
│           ├── DomainBadge.jsx     Current phase pill indicator
│           └── ProgressBar.jsx     Five-domain completion tracker
│
├── .env.example              Environment variable template
├── OVERVIEW.md               Developer reference for the full pipeline
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

**Compile is taking a long time**
The pipeline now runs five sequential LLM calls (compression, distillation, skill analysis, one call per skill, manual generation). Expect 2–5 minutes for a full compile. The button label updates at each stage to confirm progress. If the request times out, check your provider's rate limits or try a different provider.

**No skill tabs appear on the preview page**
Skill generation is fault-tolerant — if the skill analysis or schema stages fail to parse valid JSON, they are skipped and only `persona.md` and `analysis.xml` are returned. Check the server console for `Skill analysis JSON parse error` or `Skill schema JSON parse error` messages. This can happen if the provider returns malformed output; retrying the compile usually resolves it.
