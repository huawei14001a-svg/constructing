import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Broadcasts({ botId }: { botId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setList(await api.get(`/bots/${botId}/broadcasts`));
  }
  useEffect(() => { load(); }, [botId]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await api.post(`/bots/${botId}/broadcasts`, { text });
      setText('');
      setMsg('Рассылка запущена. Обновите список через несколько секунд.');
      load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-wide">
        <div className="page-head"><h2>Рассылки</h2></div>

        <div className="card" style={{ marginBottom: 24 }}>
          <label>Текст сообщения всем активным подписчикам</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Поддерживается HTML: <b>жирный</b>, <i>курсив</i>, ссылки..." />
          {msg && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{msg}</p>}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={send} disabled={busy || !text.trim()}>
              {busy ? 'Запуск...' : 'Отправить всем'}
            </button>
          </div>
        </div>

        {list.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Сообщение</th><th>Статус</th><th>Доставлено</th><th>Ошибок</th><th>Дата</th></tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.text}</td>
                  <td>{b.status === 'done' ? 'Готово' : b.status === 'sending' ? 'Отправляется...' : 'Черновик'}</td>
                  <td className="mono">{b.sentCount}</td>
                  <td className="mono muted">{b.failCount}</td>
                  <td className="muted">{new Date(b.createdAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
