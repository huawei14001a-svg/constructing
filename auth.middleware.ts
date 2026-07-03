import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { authRoutes } from './auth/auth.routes.js';
import { botRoutes } from './routes/bots.routes.js';
import { blockRoutes } from './routes/blocks.routes.js';
import { dataRoutes } from './routes/data.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health-check для Railway
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Приём апдейтов Telegram
app.use('/', webhookRoutes);

// API
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api', blockRoutes);
app.use('/api', dataRoutes);

// --- Отдача собранного фронтенда (SPA) ---
const webDist = path.resolve(process.cwd(), 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res.send('Фронтенд не собран. Выполните: npm run build')
  );
}

app.listen(config.port, () => {
  console.log(`🚀 TeleBot Constructor запущен на порту ${config.port}`);
  if (!config.appUrl) {
    console.log('ℹ️  APP_URL не задан — webhook-URL определяется из запроса.');
  }
});
