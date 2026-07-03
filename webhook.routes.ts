// Движок сценариев. Data-driven: логика бота хранится в БД (блоки/кнопки),
// а этот модуль интерпретирует входящие апдейты Telegram.
import { prisma } from '../db.js';
import { TelegramApi } from './api.js';

type AnyBot = { id: string; token: string };

const MAX_CHAIN = 15; // защита от бесконечных авто-переходов

// --- Точка входа: обработка апдейта ---
export async function handleUpdate(bot: AnyBot, update: any) {
  const api = new TelegramApi(bot.token);
  try {
    if (update.message) return await onMessage(bot, api, update.message);
    if (update.callback_query) return await onCallback(bot, api, update.callback_query);
  } catch (e) {
    console.error(`[engine ${bot.id}]`, e);
  }
}

// --- Входящее сообщение ---
async function onMessage(bot: AnyBot, api: TelegramApi, message: any) {
  const from = message.from;
  if (!from || from.is_bot) return;
  const chatId = message.chat.id;
  const text: string = message.text || '';

  const sub = await getOrCreateSubscriber(bot.id, from);

  // 1. Ждём ввод переменной?
  if (sub.awaitingVar) {
    const vars = { ...(sub.variables as Record<string, any>) };
    vars[sub.awaitingVar] = text;
    const next = sub.awaitingNext;
    await prisma.subscriber.update({
      where: { id: sub.id },
      data: { variables: vars, awaitingVar: null, awaitingNext: null },
    });
    if (next) {
      const nextBlock = await prisma.block.findUnique({ where: { id: next }, include: { buttons: true } });
      if (nextBlock) return runBlock(bot, api, { ...sub, variables: vars }, nextBlock, 0);
    }
    return;
  }

  // 2. Команда?
  if (text.startsWith('/')) {
    const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    if (cmd === 'start') {
      const start = await findBlock(bot.id, { type: 'start' });
      if (start) return runBlock(bot, api, sub, start, 0);
    }
    const cmdBlock = await findBlock(bot.id, { triggerType: 'command', triggerValue: cmd });
    if (cmdBlock) return runBlock(bot, api, sub, cmdBlock, 0);
    return; // неизвестная команда — молчим
  }

  // 3. Текстовый триггер (точное совпадение, без регистра)
  const trigger = await prisma.block.findFirst({
    where: { botId: bot.id, triggerType: 'text', triggerValue: { equals: text, mode: 'insensitive' } },
    include: { buttons: true },
  });
  if (trigger) return runBlock(bot, api, sub, trigger, 0);

  // 4. Ловец-по-умолчанию (триггер "*")
  const fallback = await findBlock(bot.id, { triggerType: 'text', triggerValue: '*' });
  if (fallback) return runBlock(bot, api, sub, fallback, 0);
}

// --- Нажатие inline-кнопки ---
async function onCallback(bot: AnyBot, api: TelegramApi, cq: any) {
  await api.answerCallbackQuery(cq.id).catch(() => {});
  const data: string = cq.data || '';
  const from = cq.from;
  const sub = await getOrCreateSubscriber(bot.id, from);

  if (data.startsWith('b:')) {
    const blockId = data.slice(2);
    const block = await prisma.block.findFirst({
      where: { id: blockId, botId: bot.id },
      include: { buttons: true },
    });
    if (block) {
      const patched = { ...sub, chatIdOverride: cq.message?.chat?.id };
      return runBlock(bot, api, patched as any, block, 0);
    }
  }
}

// --- Выполнить блок: отправить контент, поставить кнопки, обновить состояние ---
async function runBlock(bot: AnyBot, api: TelegramApi, sub: any, block: any, depth: number): Promise<void> {
  if (depth > MAX_CHAIN) return;
  const chatId = sub.chatIdOverride || sub.telegramId;
  const buttons = block.buttons || [];

  const text = renderText(block.text || '', sub);
  const keyboard = buildKeyboard(buttons);
  const extra: Record<string, any> = {};
  if (keyboard) extra.reply_markup = keyboard;

  try {
    if (block.mediaType === 'photo' && block.mediaUrl) {
      await api.sendPhoto(chatId, block.mediaUrl, text || undefined, extra);
    } else if (text) {
      await api.sendMessage(chatId, text, extra);
    }
  } catch (e: any) {
    // Пользователь заблокировал бота и т.п.
    if (e.code === 403) {
      await prisma.subscriber.update({ where: { id: sub.id }, data: { isBlocked: true } }).catch(() => {});
      return;
    }
    console.error(`[send ${bot.id}]`, e.message);
  }

  // Блок ввода: ждём ответ пользователя
  if (block.type === 'input' && block.variableName) {
    await prisma.subscriber.update({
      where: { id: sub.id },
      data: {
        currentBlockId: block.id,
        awaitingVar: block.variableName,
        awaitingNext: block.nextBlockId || null,
      },
    });
    return;
  }

  await prisma.subscriber.update({
    where: { id: sub.id },
    data: { currentBlockId: block.id, lastActiveAt: new Date() },
  });

  // Авто-переход дальше, только если нет кнопок (иначе ждём выбор)
  if (block.nextBlockId && buttons.length === 0) {
    const next = await prisma.block.findUnique({ where: { id: block.nextBlockId }, include: { buttons: true } });
    if (next) return runBlock(bot, api, sub, next, depth + 1);
  }
}

// --- Подстановка переменных {var}, {first_name}, {username} ---
function renderText(text: string, sub: any): string {
  const vars: Record<string, any> = {
    first_name: sub.firstName || '',
    last_name: sub.lastName || '',
    username: sub.username || '',
    id: sub.telegramId || '',
    ...((sub.variables as Record<string, any>) || {}),
  };
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

// --- Сборка inline-клавиатуры из кнопок блока ---
function buildKeyboard(buttons: any[]) {
  if (!buttons.length) return null;
  const rows: Record<number, any[]> = {};
  const sorted = [...buttons].sort((a, b) => a.row - b.row || a.position - b.position);
  for (const btn of sorted) {
    rows[btn.row] = rows[btn.row] || [];
    if (btn.action === 'url' && btn.url) {
      rows[btn.row].push({ text: btn.text, url: btn.url });
    } else {
      rows[btn.row].push({ text: btn.text, callback_data: `b:${btn.targetBlockId || ''}` });
    }
  }
  return { inline_keyboard: Object.keys(rows).sort((a, b) => +a - +b).map((k) => rows[+k]) };
}

// --- Утилиты ---
async function findBlock(botId: string, where: Record<string, any>) {
  return prisma.block.findFirst({ where: { botId, ...where }, include: { buttons: true } });
}

async function getOrCreateSubscriber(botId: string, from: any) {
  const telegramId = String(from.id);
  const existing = await prisma.subscriber.findUnique({
    where: { botId_telegramId: { botId, telegramId } },
  });
  if (existing) {
    return prisma.subscriber.update({
      where: { id: existing.id },
      data: {
        username: from.username || existing.username,
        firstName: from.first_name || existing.firstName,
        lastName: from.last_name || existing.lastName,
        isBlocked: false,
        lastActiveAt: new Date(),
      },
    });
  }
  return prisma.subscriber.create({
    data: {
      botId,
      telegramId,
      username: from.username || null,
      firstName: from.first_name || null,
      lastName: from.last_name || null,
    },
  });
}
