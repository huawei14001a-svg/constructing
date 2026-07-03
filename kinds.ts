import { useEffect, useState } from 'react';
import { Block, Btn, Kind, KIND_META, getKind, applyKind } from '../kinds';

const KINDS: Kind[] = ['start', 'command', 'text', 'message', 'input'];
const TOKENS = ['{first_name}', '{username}', '{id}'];

type Props = {
  block: Block;
  blocks: Block[];
  onSave: (b: Block) => void;
  onDelete: (id: string) => void;
};

export default function Inspector({ block, blocks, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Block>(block);
  useEffect(() => setDraft(block), [block.id]);

  const kind = getKind(draft);
  const set = (patch: Partial<Block>) => setDraft((d) => ({ ...d, ...patch }));

  function setButton(i: number, patch: Partial<Btn>) {
    const buttons = draft.buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b));
    set({ buttons });
  }
  function addButton() {
    set({ buttons: [...draft.buttons, { text: 'Кнопка', action: 'goto', targetBlockId: null, row: draft.buttons.length }] });
  }
  function removeButton(i: number) {
    set({ buttons: draft.buttons.filter((_, idx) => idx !== i) });
  }

  const others = blocks.filter((b) => b.id !== draft.id);

  return (
    <div className="inspector">
      <div className="inspector-inner">
        <h3>{KIND_META[kind].label}</h3>
        <p className="hint">Настройте, что и когда отправляет бот.</p>

        <div className="insp-field">
          <label>Тип блока</label>
          <div className="type-select">
            {KINDS.map((k) => (
              <button
                key={k}
                className={`type-opt ${k === kind ? 'active' : ''}`}
                onClick={() => set(applyKind(k))}
              >
                <span className={`node-type-dot ${KIND_META[k].cls}`} /> {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="insp-field">
          <label>Название (для вас)</label>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>

        {kind === 'command' && (
          <div className="insp-field">
            <label>Команда (без «/»)</label>
            <input className="mono" value={draft.triggerValue || ''} onChange={(e) => set({ triggerValue: e.target.value.replace(/^\//, '') })} placeholder="help" />
          </div>
        )}

        {kind === 'text' && (
          <div className="insp-field">
            <label>Фраза-триггер (или * для любого текста)</label>
            <input value={draft.triggerValue || ''} onChange={(e) => set({ triggerValue: e.target.value })} placeholder="Цена" />
          </div>
        )}

        {kind === 'input' && (
          <div className="insp-field">
            <label>Сохранить ответ в переменную</label>
            <input className="mono" value={draft.variableName || ''} onChange={(e) => set({ variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })} placeholder="phone" />
          </div>
        )}

        <div className="insp-field">
          <label>Текст сообщения</label>
          <textarea value={draft.text} onChange={(e) => set({ text: e.target.value })} placeholder="Что напишет бот..." />
          <div className="chips">
            {TOKENS.map((t) => (
              <span key={t} className="token-chip" onClick={() => set({ text: draft.text + ' ' + t })}>{t}</span>
            ))}
          </div>
        </div>

        <div className="insp-field">
          <label>Фото (URL, необязательно)</label>
          <input
            value={draft.mediaUrl || ''}
            onChange={(e) => set({ mediaUrl: e.target.value, mediaType: e.target.value ? 'photo' : null })}
            placeholder="https://..."
          />
        </div>

        <div className="divider" />

        <div className="insp-field">
          <label>Inline-кнопки</label>
          {draft.buttons.map((btn, i) => (
            <div key={i} style={{ marginBottom: 12, padding: 10, border: '1px solid var(--line)', borderRadius: 8 }}>
              <div className="btn-row">
                <input value={btn.text} onChange={(e) => setButton(i, { text: e.target.value })} placeholder="Текст кнопки" />
                <button className="btn btn-ghost btn-sm" onClick={() => removeButton(i)}>✕</button>
              </div>
              <div className="btn-row">
                <select value={btn.action} onChange={(e) => setButton(i, { action: e.target.value as any })}>
                  <option value="goto">→ Перейти к блоку</option>
                  <option value="url">🔗 Открыть ссылку</option>
                </select>
              </div>
              {btn.action === 'goto' ? (
                <select value={btn.targetBlockId || ''} onChange={(e) => setButton(i, { targetBlockId: e.target.value })}>
                  <option value="">— выберите блок —</option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              ) : (
                <input value={btn.url || ''} onChange={(e) => setButton(i, { url: e.target.value })} placeholder="https://..." />
              )}
            </div>
          ))}
          <button className="btn btn-sm" onClick={addButton}>+ Добавить кнопку</button>
        </div>

        {(kind === 'message' || kind === 'input' || kind === 'start' || kind === 'command') && draft.buttons.length === 0 && (
          <div className="insp-field">
            <label>Следующий блок (авто-переход)</label>
            <select value={draft.nextBlockId || ''} onChange={(e) => set({ nextBlockId: e.target.value || null })}>
              <option value="">— нет —</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="divider" />
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => onSave(draft)}>
          Сохранить блок
        </button>
        {kind !== 'start' && (
          <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => onDelete(draft.id)}>
            Удалить блок
          </button>
        )}
      </div>
    </div>
  );
}
