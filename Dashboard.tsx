import { useRef, useState, useEffect } from 'react';
import { Block, getKind, KIND_META } from '../kinds';

const NODE_W = 220;
const ANCHOR_Y = 26; // высота шапки для точки привязки провода

type Props = {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
};

export default function FlowCanvas({ blocks, selectedId, onSelect, onMove }: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string | null; startX: number; startY: number; origX: number; origY: number; panning: boolean }>({
    id: null, startX: 0, startY: 0, origX: 0, origY: 0, panning: false,
  });

  // локальная копия позиций для плавного перетаскивания
  useEffect(() => {
    const next: Record<string, { x: number; y: number }> = {};
    for (const b of blocks) next[b.id] = { x: b.posX, y: b.posY };
    setPositions(next);
  }, [blocks]);

  function nodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    onSelect(id);
    const p = positions[id] || { x: 0, y: 0 };
    drag.current = { id, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, panning: false };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
  }

  function bgMouseDown(e: React.MouseEvent) {
    drag.current = { id: null, startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y, panning: true };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
  }

  function onDragMove(e: MouseEvent) {
    const d = drag.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.panning) {
      setPan({ x: d.origX + dx, y: d.origY + dy });
    } else if (d.id) {
      setPositions((prev) => ({ ...prev, [d.id!]: { x: d.origX + dx, y: d.origY + dy } }));
    }
  }

  function onDragUp() {
    const d = drag.current;
    if (d.id) {
      const p = positions[d.id];
      // читаем актуальное значение из состояния через функцию
      setPositions((prev) => {
        const cur = prev[d.id!];
        if (cur) onMove(d.id!, Math.round(cur.x), Math.round(cur.y));
        return prev;
      });
    }
    drag.current.id = null;
    drag.current.panning = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragUp);
  }

  // построение проводов
  const wires: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
  for (const b of blocks) {
    const from = positions[b.id];
    if (!from) continue;
    const targets: string[] = [];
    if (b.nextBlockId && b.buttons.length === 0) targets.push(b.nextBlockId);
    for (const btn of b.buttons) if (btn.action === 'goto' && btn.targetBlockId) targets.push(btn.targetBlockId);
    for (const t of targets) {
      const to = positions[t];
      if (!to || !byId[t]) continue;
      wires.push({
        key: `${b.id}->${t}`,
        x1: from.x + NODE_W,
        y1: from.y + ANCHOR_Y,
        x2: to.x,
        y2: to.y + ANCHOR_Y,
      });
    }
  }

  return (
    <div className="canvas-wrap" onMouseDown={bgMouseDown}>
      <div className="canvas-hint">Тяните узлы, чтобы разложить сценарий. Пустое поле — панорамирование.</div>
      <div className="canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
        <svg className="wires" width="6000" height="4000">
          {wires.map((w) => {
            const midX = (w.x1 + w.x2) / 2;
            return (
              <path
                key={w.key}
                d={`M ${w.x1} ${w.y1} C ${midX} ${w.y1}, ${midX} ${w.y2}, ${w.x2} ${w.y2}`}
                fill="none"
                stroke="#35d0e0"
                strokeWidth={2}
                strokeOpacity={0.55}
              />
            );
          })}
        </svg>

        {blocks.map((b) => {
          const pos = positions[b.id] || { x: b.posX, y: b.posY };
          const kind = getKind(b);
          const meta = KIND_META[kind];
          const trig =
            kind === 'command' ? `/${b.triggerValue || 'команда'}` :
            kind === 'text' ? `≈ ${b.triggerValue || 'фраза'}` :
            kind === 'start' ? '/start' :
            kind === 'input' ? `→ {${b.variableName || 'переменная'}}` : '';
          return (
            <div
              key={b.id}
              className={`node ${b.id === selectedId ? 'selected' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              onMouseDown={(e) => nodeMouseDown(e, b.id)}
            >
              <div className="node-head">
                <span className={`node-type-dot ${meta.cls}`} />
                <span className="node-name">{b.name}</span>
              </div>
              {trig && <div className="node-trigger">{trig}</div>}
              <div className="node-body">{b.text || <span style={{ color: 'var(--muted-2)' }}>пустой текст</span>}</div>
              {b.buttons.length > 0 && (
                <div className="node-btns">
                  {b.buttons.slice(0, 4).map((btn, i) => (
                    <div key={i} className="node-btn">{btn.text}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
