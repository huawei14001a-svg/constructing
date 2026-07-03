import { Router } from 'express';
import { prisma } from '../db.js';
import { auth, type AuthedRequest } from '../auth/auth.middleware.js';
import { TelegramApi } from '../telegram/api.js';

export const dataRoutes = Router();
dataRoutes.use(auth);

async function ownBot(userId: string, botId: string) {
  return prisma.bot.findFirst({ where: { id: botId, userId } });
}

// --- Подписчики ---
dataRoutes.get('/bots/:botId/subscribers', async (req: AuthedRequest, res) => {
  if (!(await ownBot(req.userId!, req.params.botId)))
    return res.status(404).json({ error: 'Бот не найден' });
  const subs = await prisma.subscriber.findMany({
    where: { botId: req.params.botId },
    orderBy: { joinedAt: 'desc' },
    take: 500,
  });
  res.json(subs);
});

// --- Рассылки ---
dataRoutes.get('/bots/:botId/broadcasts', async (req: AuthedRequest, res) => {
  if (!(await ownBot(req.userId!, req.params.botId)))
    return res.status(404).json({ error: 'Бот не найден' });
  const list = await prisma.broadcast.findMany({
    where: { botId: req.params.botId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(list);
});

// Создать и запустить рассылку (в фоне)
dataRoutes.post('/bots/:botId/broadcasts', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.botId);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Введите текст рассылки' });

  const broadcast = await prisma.broadcast.create({
    data: { botId: bot.id, text, status: 'sending' },
  });

  // Отправляем асинхронно, не блокируя ответ
  sendBroadcast(bot, broadcast.id, text).catch((e) => console.error('broadcast', e));
  res.json(broadcast);
});

async function sendBroadcast(bot: { id: string; token: string }, broadcastId: string, text: string) {
  const api = new TelegramApi(bot.token);
  const subs = await prisma.subscriber.findMany({
    where: { botId: bot.id, isBlocked: false },
    select: { id: true, telegramId: true },
  });
  let sent = 0;
  let fail = 0;
  for (const s of subs) {
    try {
      await api.sendMessage(s.telegramId, text);
      sent++;
    } catch (e: any) {
      fail++;
      if (e.code === 403) {
        await prisma.subscriber.update({ where: { id: s.id }, data: { isBlocked: true } }).catch(() => {});
      }
    }
    // Троттлинг ~25 сообщений/сек (лимит Telegram ~30)
    await new Promise((r) => setTimeout(r, 40));
  }
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'done', sentCount: sent, failCount: fail },
  });
}
