import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Subscribers({ botId }: { botId: string }) {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bots/${botId}/subscribers`).then((s) => { setSubs(s); setLoading(false); });
  }, [botId]);

  if (loading) return <div className="center" style={{ height: 200 }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-wide">
        <div className="page-head"><h2>Подписчики</h2><div className="spacer" /><span className="muted">{subs.length}</span></div>
        {subs.length === 0 ? (
          <div className="empty">Пока никто не написал боту. Как только напишут — появятся здесь.</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Имя</th><th>Username</th><th>Telegram ID</th><th>Статус</th><th>Пришёл</th></tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="mono">{s.username ? '@' + s.username : '—'}</td>
                  <td className="mono muted">{s.telegramId}</td>
                  <td>
                    {s.isBlocked
                      ? <span className="status-pill status-off"><span className="status-dot" /> Заблокировал</span>
                      : <span className="status-pill status-on"><span className="status-dot" /> Активен</span>}
                  </td>
                  <td className="muted">{new Date(s.joinedAt).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
