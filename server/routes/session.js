const express = require('express');
const router = express.Router();

router.post('/init', (req, res) => {
  const { domainType } = req.body;
  const validTypes = ['general', 'coding', 'writing', 'communication'];

  if (!validTypes.includes(domainType)) {
    return res.status(400).json({ error: 'Invalid domainType' });
  }

  req.session.domainType = domainType;
  req.session.transcript = [];
  req.session.exchangeCount = 0;
  req.session.currentDomain = 'voice';
  req.session.compileUnlocked = false;

  req.session.save((err) => {
    if (err) return res.status(500).json({ error: 'Session save failed' });
    res.json({ ok: true, domainType });
  });
});

router.get('/state', (req, res) => {
  if (!req.session.domainType) {
    return res.json({ initialized: false });
  }
  res.json({
    initialized: true,
    domainType: req.session.domainType,
    currentDomain: req.session.currentDomain,
    exchangeCount: req.session.exchangeCount,
    compileUnlocked: req.session.compileUnlocked,
  });
});

router.post('/reset', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Session destroy failed' });
    res.json({ ok: true });
  });
});

module.exports = router;
