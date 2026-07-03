import { Router } from 'express';
import { prisma } from '../db.js';
import { handleUpdate } from '../telegram/engine.js';

export const webhookRoutes = Router();

// Telegram шлёт апдейты сюда. Отвечаем 200 сразу, обрабатываем в фоне.
webhookRoutes.post('/webhook/:botId', async (req, res) => {
  const secret = req.header('x-telegram-bot-api-secret-token');
  const bot = await prisma.bot.findUnique({
    where: { id: req.params.botId },
    select: { id: true, token: true, isActive: true, webhookSecret: true },
  });

  if (!bot || !bot.isActive) return res.sendStatus(200);
  if (secret !== bot.webhookSecret) return res.sendStatus(403);

  res.sendStatus(200); // мгновенный ACK, чтобы Telegram не ретраил
  handleUpdate({ id: bot.id, token: bot.token }, req.body).catch((e) =>
    console.error('[webhook]', e)
  );
});
