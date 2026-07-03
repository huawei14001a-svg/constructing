import type { Request } from 'express';
import { config } from '../config.js';

// Определяет публичный базовый URL приложения.
// Приоритет: APP_URL из env → заголовки прокси Railway → host запроса.
export function publicBaseUrl(req: Request): string {
  if (config.appUrl) return config.appUrl;
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  return `${proto}://${host}`;
}

export function webhookUrl(req: Request, botId: string): string {
  return `${publicBaseUrl(req)}/webhook/${botId}`;
}
