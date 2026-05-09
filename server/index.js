require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);

const interviewRouter = require('./routes/interview');
const compileRouter = require('./routes/compile');
const sessionRouter = require('./routes/session');
const { getAvailableProviders } = require('./providers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  }),
  cookie: {
    maxAge: 30 * 60 * 1000, // 30 minutes
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.get('/api/providers', (req, res) => {
  res.json(getAvailableProviders());
});

app.use('/api/chat', interviewRouter);
app.use('/api/compile', compileRouter);
app.use('/api/session', sessionRouter);

app.listen(PORT, () => {
  console.log(`PersonaMirror server running on http://localhost:${PORT}`);
});
