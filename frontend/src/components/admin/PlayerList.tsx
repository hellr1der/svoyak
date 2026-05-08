import { useState } from "react";
import type { AdminGameState } from "../../types/game";

type Props = {
  state: AdminGameState;
  busy: boolean;
  onAdjust: (playerId: string, delta: number) => Promise<void>;
  onRemove: (playerId: string) => Promise<void>;
};

export function PlayerList({ state, busy, onAdjust, onRemove }: Props) {
  const [customById, setCustomById] = useState<Record<string, string>>({});

  return (
    <aside className="admin-sidebar-inner">
      <h3 className="admin-sidebar-inner__title">Игроки</h3>
      <ul className="admin-player-list">
        {state.players.map((p) => (
          <li key={p.id} className="admin-player-list__item">
            <div className="admin-player-list__row">
              <span className="admin-player-list__name">{p.name}</span>
              <span className="admin-player-list__score">{p.score}</span>
              <span
                className={
                  p.is_connected
                    ? "admin-player-list__dot admin-player-list__dot--on"
                    : "admin-player-list__dot admin-player-list__dot--off"
                }
                title={p.is_connected ? "онлайн" : "офлайн"}
              />
            </div>
            <div className="admin-player-list__adjust">
              <button
                type="button"
                className="admin-player-list__pm"
                disabled={busy}
                onClick={() => onAdjust(p.id, -100)}
              >
                −
              </button>
              <button
                type="button"
                className="admin-player-list__pm"
                disabled={busy}
                onClick={() => onAdjust(p.id, 100)}
              >
                +
              </button>
            </div>
            <div className="admin-player-list__custom">
              <input
                type="number"
                className="admin-player-list__input"
                placeholder="Δ очков"
                value={customById[p.id] ?? ""}
                onChange={(e) =>
                  setCustomById((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                disabled={busy}
              />
              <button
                type="button"
                className="admin-btn admin-btn--small"
                disabled={busy}
                onClick={() => {
                  const raw = customById[p.id]?.trim();
                  if (raw === undefined || raw === "") {
                    return;
                  }
                  const n = parseInt(raw, 10);
                  if (Number.isNaN(n)) {
                    return;
                  }
                  void onAdjust(p.id, n).then(() =>
                    setCustomById((prev) => {
                      const next = { ...prev };
                      delete next[p.id];
                      return next;
                    }),
                  );
                }}
              >
                Применить
              </button>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn--small admin-btn--danger admin-player-list__remove"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    `Удалить игрока «${p.name}» из игры? Его сессия отключится от состояния.`,
                  )
                ) {
                  return;
                }
                void onRemove(p.id);
              }}
            >
              Удалить из игры
            </button>
          </li>
        ))}
      </ul>
      {state.players.length === 0 ? (
        <p className="admin-player-list__empty">Пока никто не подключился</p>
      ) : null}
    </aside>
  );
}
