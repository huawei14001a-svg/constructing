// Тонкий клиент Telegram Bot API. Работает с любым токеном.
// Node 20+ имеет глобальный fetch.

export class TelegramApi {
  constructor(private token: string) {}

  private base() {
    return `https://api.telegram.org/bot${this.token}`;
  }

  async call<T = any>(method: string, params: Record<string, any> = {}): Promise<T> {
    const res = await fetch(`${this.base()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data: any = await res.json();
    if (!data.ok) {
      const err: any = new Error(data.description || `Telegram API error: ${method}`);
      err.code = data.error_code;
      throw err;
    }
    return data.result as T;
  }

  getMe() {
    return this.call('getMe');
  }

  sendMessage(chatId: string | number, text: string, extra: Record<string, any> = {}) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  sendPhoto(chatId: string | number, photo: string, caption?: string, extra: Record<string, any> = {}) {
    return this.call('sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
      ...extra,
    });
  }

  answerCallbackQuery(id: string, text?: string) {
    return this.call('answerCallbackQuery', { callback_query_id: id, text });
  }

  setWebhook(url: string, secretToken: string) {
    return this.call('setWebhook', {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
  }

  deleteWebhook() {
    return this.call('deleteWebhook', { drop_pending_updates: false });
  }
}
