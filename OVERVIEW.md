# Persona Mirror — Developer Overview

This document explains what was built, why it exists, and how to use the output. Written for a developer reading the project for the first time.

---

## What was built

### New files

**`server/prompts/skill_analysis.js`**
A system prompt that takes the forensic XML produced by the compression stage and returns a JSON array of 2–5 skill objects. Each object has a `name` (snake_case), `rationale` (one sentence of forensic evidence), and `domain` (which behavioral domain drove the selection). The prompt enforces strict JSON-only output and instructs the model to ground every skill in actual behavioral signals from the XML — not generic traits. This runs once per compile session.

**`server/prompts/skill_schema.js`**
A system prompt that takes one skill (name + rationale) and the forensic XML and produces two artifacts: a `SKILL.md` file (human-readable skill definition grounded in this persona's actual patterns) and a `toolSchema` object (Anthropic-format tool definition for API use). The prompt requires output as a single JSON object with two keys: `skillMd` (string) and `toolSchema` (object). This runs once per skill, in a loop inside the compile route.

**`server/prompts/manual.js`**
A system prompt that takes the persona.md content and the full skills array and generates a complete `manual.md` in two sections: one for the human who received the bundle (what each file is, how to use with Claude.ai, how to use with the API) and one for the AI agent that will be initialized with the persona (persona pasted inline, skills listed with triggers, behavioral instructions). Output is plain markdown — no JSON wrapper.

**`OVERVIEW.md`** (this file)
Developer reference for the complete project.

---

### Modified files

**`server/routes/compile.js`**
Extended from a two-stage pipeline (compression → distillation) to a five-stage pipeline. Stages 3–5 run after distillation: skill analysis (one call), skill schema generation (one call per skill, sequential), and manual generation (one call). A `cleanJson()` helper strips markdown code fences that LLMs sometimes emit despite being instructed not to. All JSON.parse calls are wrapped in try/catch; failures log the raw output and fall through gracefully — the persona.md is always returned even if skill generation fails entirely. The response object is extended with `skills`, `skillsJson`, and `manualMd` alongside the existing `persona` and `aboutMe` fields.

**`client/src/pages/PreviewPage.jsx`**
Rewritten to handle the extended compile response. Tabs are now built dynamically from the response data: `persona.md` and `analysis.xml` are always present; skill tabs (`SKILL_<name>.md`), `skills.json`, and `manual.md` appear only when the compile pipeline produced them. Each tab has a per-tab download button in the header. A "Download .zip" button uses JSZip to bundle all files in the structure `persona.md`, `skills/SKILL_*.md`, `skills.json`, `manual.md`. The tab bar supports horizontal scrolling to accommodate up to 9 tabs without layout breakage.

**`client/src/pages/InterviewPage.jsx`**
The `handleCompile` function now destructures all new fields from the response (`skills`, `skillsJson`, `manualMd`) and passes them to the navigate state. A step-cycling timer updates a `compileStep` state every 40 seconds while the compile is running, advancing through: "Compiling persona..." → "Analyzing skills..." → "Building skills..." → "Writing manual..." → "Finalizing...". The compile button label reflects the current step. The timer is always cleared (both on success and error) to prevent state leaks.

---

## The full workflow

```
User opens the app
  ↓
InterviewPage.jsx (phase: 'select')
  → POST /api/session/init  (session.js)
  → Stores domainType in session

InterviewPage.jsx (phase: 'interview')
  → POST /api/chat  (interview.js)
  → SSE stream: interview questions across 5 domains
  → interview.js sets session.compileUnlocked = true when complete

User clicks "Compile Persona"
  ↓
InterviewPage.jsx: handleCompile()
  → POST /api/compile  (compile.js)
  → Step 1: getCompressionPrompt() + transcript → forensic XML (4096 tokens)
  → Step 2: getDistillationPrompt() + forensic XML → persona.md (5000 tokens)
  → Step 3: getSkillAnalysisPrompt() + forensic XML → JSON skill list (1024 tokens)
  → Step 4: for each skill: getSkillSchemaPrompt() + skill + forensic XML → { skillMd, toolSchema } (4096 tokens)
  → Step 5: getManualPrompt() + persona.md + skills → manual.md (5000 tokens)
  → Session destroyed
  → Response: { persona, aboutMe, skills, skillsJson, manualMd }

navigate('/preview', { state: { ... } })
  ↓
PreviewPage.jsx
  → Renders tabs dynamically from state
  → User browses tabs, downloads individual files, or downloads full .zip
```

---

## The architectural reasoning

The system is built around a distinction from agent design: **system prompt** (who the agent is) vs. **agent skills** (what the agent does). This separation matters because:

- **System prompts are always active.** They define tone, values, style, and reasoning — everything that should be true of every response the agent gives. Putting skills in the system prompt bloats it and makes skill boundaries fuzzy.
- **Skills are invoked on demand.** They have defined inputs, outputs, and trigger conditions. Separating them makes it possible for the LLM to choose which skill applies (via tool_use) rather than trying to blend everything.

In the Persona Mirror output bundle:
- `persona.md` is the system prompt — the agent's identity. It is always loaded.
- `SKILL_*.md` files are human-readable skill definitions — they teach a human (or the agent via knowledge files) what each skill does and when to use it.
- `skills.json` is the machine-callable layer — the Anthropic tool schemas that enable the LLM to select and invoke skills via structured tool_use calls.
- `manual.md` bridges both halves — it tells the human how to wire everything together and tells the AI agent how to use its own skills.

The forensic XML is the engine behind all of this. It is dense, structured behavioral data that gives the LLM enough specificity to generate skills grounded in this actual person rather than generic templates.

---

## How to use the output

If you receive the `persona_bundle.zip`, here is what to do:

**With Claude.ai:**
1. Unzip the bundle
2. Go to [claude.ai](https://claude.ai) → Projects → New Project
3. Paste the contents of `persona.md` into the Project Instructions field
4. Upload each `SKILL_*.md` file as a Project Knowledge file
5. Start a conversation — Claude will respond as this persona and can invoke skills when appropriate

**With the Anthropic API:**
```javascript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic();
const systemPrompt = fs.readFileSync('persona.md', 'utf8');
const tools = JSON.parse(fs.readFileSync('skills.json', 'utf8'));

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: systemPrompt,
  tools: tools,
  messages: [{ role: 'user', content: 'Draft a reply to this email: ...' }],
});
```

**With OpenAI or other providers:**
The `skills.json` uses Anthropic tool schema format. OpenAI uses a slightly different envelope (`{ type: "function", function: { name, description, parameters } }`). You will need to wrap each tool schema before using it with the OpenAI SDK.

---

## Known limitations

1. **Skills are descriptive, not live integrations.** The generated skills define how to behave — they do not connect to external services, databases, or APIs. They are behavioral scaffolding, not automation.

2. **Quality depends on interview depth.** The forensic XML is only as good as the interview answers. Thin or evasive answers produce thin behavioral signals, which produce generic skills. The compression prompt explicitly notes weak areas in `<confidence_internal>`.

3. **JSON reliability varies by provider.** All three providers (Anthropic, OpenAI, Gemini) are instructed to output only valid JSON for structured stages. In practice, models occasionally emit markdown fences or preambles. The `cleanJson()` helper in compile.js strips common artifacts, but unusual malformed outputs can still fail parsing. When this happens, the compile route logs the raw output and falls through (returning the persona.md without the failed skill).

4. **Token limits constrain skill depth.** Each skill schema call is capped at 4096 output tokens. Very complex personas with many documented behaviors may produce SKILL.md files that are truncated. This is unlikely with most interview responses but possible with extremely verbose forensic XML.

5. **Skills do not update as the persona evolves.** The bundle is a snapshot. If the person's behavior or preferences change significantly, a new interview is needed to regenerate skills that reflect the updated profile.

6. **No skill deduplication across runs.** Running the compile twice on the same interview may produce different skill names or slightly different schemas. The skill analysis prompt picks skills probabilistically — results are not deterministic.
