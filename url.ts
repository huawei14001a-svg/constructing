import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // Публичный адрес приложения (для webhook). На Railway это ваш домен.
  // Если не задан — определяется из заголовков запроса при активации бота.
  appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
  nodeEnv: process.env.NODE_ENV || 'development',
};
