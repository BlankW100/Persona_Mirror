const express = require('express');
const { generateText } = require('../providers');
const { getCompressionPrompt } = require('../prompts/compression');
const { getDistillationPrompt } = require('../prompts/distillation');
const { getSkillAnalysisPrompt } = require('../prompts/skill_analysis');
const { getSkillSchemaPrompt } = require('../prompts/skill_schema');
const { getManualPrompt } = require('../prompts/manual');

const router = express.Router();

const VALID_PROVIDERS = ['anthropic', 'openai', 'gemini'];

// Strip markdown code fences that LLMs add despite being told not to
function cleanJson(raw) {
  return raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
}

router.post('/', async (req, res) => {
  if (!req.session.compileUnlocked) {
    return res.status(403).json({ error: 'Interview not complete' });
  }

  const transcript = req.session.transcript || [];
  if (transcript.length === 0) {
    return res.status(400).json({ error: 'No transcript to compile' });
  }

  const { provider = 'anthropic' } = req.body;
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }

  const domainType = req.session.domainType || 'general';

  const transcriptText = transcript
    .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n\n');

  try {
    // Stage 1: forensic XML — structured analysis of the interview
    const forensicXml = await generateText(
      provider,
      getCompressionPrompt(),
      [{ role: 'user', content: `Domain type: ${domainType}\n\nTranscript:\n\n${transcriptText}` }],
      4096
    );

    // Stage 2: persona.md — distill forensic XML into a compact identity system prompt
    const personaMd = await generateText(
      provider,
      getDistillationPrompt(),
      [{ role: 'user', content: forensicXml }],
      5000
    );

    // Stage 3: skill analysis — identify which skills this persona needs
    let skillList = [];
    let skillListRaw = '';
    try {
      skillListRaw = await generateText(
        provider,
        getSkillAnalysisPrompt(),
        [{ role: 'user', content: forensicXml }],
        1024
      );
      skillList = JSON.parse(cleanJson(skillListRaw));
      if (!Array.isArray(skillList)) skillList = [];
    } catch (parseErr) {
      console.error('Skill analysis JSON parse error. Raw output:\n', skillListRaw);
      // Fall through with empty skill list — persona.md is still returned
    }

    // Stage 4: generate each skill's SKILL.md + tool schema
    const skills = [];
    for (const skill of skillList) {
      let skillOutputRaw = '';
      try {
        skillOutputRaw = await generateText(
          provider,
          getSkillSchemaPrompt(),
          [{
            role: 'user',
            content: `Skill name: ${skill.name}\nRationale: ${skill.rationale}\nDomain: ${skill.domain}\n\nForensic XML:\n${forensicXml}`,
          }],
          4096
        );
        const skillOutput = JSON.parse(cleanJson(skillOutputRaw));
        if (skillOutput.skillMd && skillOutput.toolSchema) {
          skills.push({
            name: skill.name,
            skillMd: skillOutput.skillMd,
            toolSchema: skillOutput.toolSchema,
          });
        }
      } catch (parseErr) {
        console.error(`Skill schema JSON parse error for "${skill.name}". Raw output:\n`, skillOutputRaw);
        // Skip this skill and continue with the rest
      }
    }

    // Stage 5: generate manual.md
    let manualMd = '';
    try {
      manualMd = await generateText(
        provider,
        getManualPrompt(),
        [{
          role: 'user',
          content: `PERSONA.MD:\n${personaMd}\n\nSKILLS:\n${JSON.stringify(skills, null, 2)}`,
        }],
        5000
      );
    } catch (manualErr) {
      console.error('Manual generation error:', manualErr.message);
    }

    req.session.destroy((err) => {
      if (err) console.error('Session destroy error after compile:', err.message);
    });

    res.json({
      persona: forensicXml,
      aboutMe: personaMd,
      skills,
      skillsJson: skills.map((s) => s.toolSchema),
      manualMd,
    });
  } catch (err) {
    console.error('Compile error:', err.message);
    res.status(500).json({ error: `Provider error: ${err.message}` });
  }
});

module.exports = router;
