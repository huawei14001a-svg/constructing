import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { auth, type AuthedRequest } from '../auth/auth.middleware.js';
import { TelegramApi } from '../telegram/api.js';
import { webhookUrl } from './url.js';

export const botRoutes = Router();
botRoutes.use(auth);

// Проверка, что бот принадлежит текущему пользователю
async function ownBot(userId: string, botId: string) {
  return prisma.bot.findFirst({ where: { id: botId, userId } });
}

// Список ботов пользователя
botRoutes.get('/', async (req: AuthedRequest, res) => {
  const bots = await prisma.bot.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { subscribers: true, blocks: true } } },
  });
  res.json(bots);
});

// Создать бота: валидируем токен через getMe, создаём стартовый блок
botRoutes.post('/', async (req: AuthedRequest, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), token: z.string().min(20) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Укажите токен бота' });

  const api = new TelegramApi(parsed.data.token);
  let me: any;
  try {
    me = await api.getMe();
  } catch {
    return res.status(400).json({ error: 'Токен недействителен. Проверьте его у @BotFather' });
  }

  const bot = await prisma.bot.create({
    data: {
      userId: req.userId!,
      name: parsed.data.name || me.first_name || 'Мой бот',
      token: parsed.data.token,
      username: me.username || null,
    },
  });

  // Стартовый блок по умолчанию
  await prisma.block.create({
    data: {
      botId: bot.id,
      type: 'start',
      name: 'Старт',
      triggerType: 'start',
      triggerValue: 'start',
      text: 'Привет, {first_name}! 👋\n\nЭто бот, собранный в конструкторе. Отредактируйте этот блок в редакторе сценария.',
      posX: 80,
      posY: 80,
    },
  });

  res.json(bot);
});

// Детали бота
botRoutes.get('/:id', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.id);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  res.json(bot);
});

// Переименовать
botRoutes.patch('/:id', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.id);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: { name: typeof req.body.name === 'string' ? req.body.name : bot.name },
  });
  res.json(updated);
});

// Запустить: устанавливаем webhook
botRoutes.post('/:id/activate', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.id);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  const api = new TelegramApi(bot.token);
  try {
    await api.setWebhook(webhookUrl(req, bot.id), bot.webhookSecret);
  } catch (e: any) {
    return res.status(400).json({ error: `Не удалось установить webhook: ${e.message}` });
  }
  const updated = await prisma.bot.update({ where: { id: bot.id }, data: { isActive: true } });
  res.json(updated);
});

// Остановить: снимаем webhook
botRoutes.post('/:id/deactivate', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.id);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  const api = new TelegramApi(bot.token);
  await api.deleteWebhook().catch(() => {});
  const updated = await prisma.bot.update({ where: { id: bot.id }, data: { isActive: false } });
  res.json(updated);
});

// Удалить
botRoutes.delete('/:id', async (req: AuthedRequest, res) => {
  const bot = await ownBot(req.userId!, req.params.id);
  if (!bot) return res.status(404).json({ error: 'Бот не найден' });
  await new TelegramApi(bot.token).deleteWebhook().catch(() => {});
  await prisma.bot.delete({ where: { id: bot.id } });
  res.json({ ok: true });
});
