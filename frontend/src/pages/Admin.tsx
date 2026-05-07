import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { FinalControl } from "../components/admin/FinalControl";
import { GameBoard } from "../components/admin/GameBoard";
import { PlayerList } from "../components/admin/PlayerList";
import { QuestionControl } from "../components/admin/QuestionControl";
import { useWebSocket } from "../hooks/useWebSocket";
import { parseAdminGameState, type AdminGameState } from "../types/game";
import "./adminScreen.css";

type QuestionDTO = {
  price: number | null;
  question: string;
  question_image: string | null;
  answer: string;
  answer_image: string | null;
};

type ThemeDTO = {
  name: string;
  questions: QuestionDTO[];
};

type RoundDTO = {
  name: string;
  themes: ThemeDTO[];
  is_final?: boolean;
};

type PackDTO = {
  rounds: RoundDTO[];
};

function formatPrices(questions: QuestionDTO[]): string {
  return questions
    .map((q) => (q.price === null || q.price === undefined ? "—" : String(q.price)))
    .join(", ");
}

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string") {
        return detail;
      }
      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (item && typeof item === "object" && "msg" in item) {
              return String((item as { msg: unknown }).msg);
            }
            return JSON.stringify(item);
          })
          .join(". ");
      }
    }
  } catch {
    /* ignore */
  }
  return res.statusText || `Ошибка ${res.status}`;
}

export function Admin() {
  const { lastMessage } = useWebSocket();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<PackDTO | null>(null);
  const [admin, setAdmin] = useState<AdminGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const refreshPackPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pack");
      if (res.status === 404) {
        setPack(null);
        return;
      }
      if (!res.ok) {
        setError(await readErrorDetail(res));
        return;
      }
      const data = (await res.json()) as PackDTO;
      setPack(data);
    } catch {
      setError("Не удалось связаться с сервером. Запущен ли бэкенд?");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/state");
      if (!res.ok) {
        return;
      }
      const data: unknown = await res.json();
      const parsed = parseAdminGameState(data);
      setAdmin(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshPackPreview();
  }, [refreshPackPreview]);

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin, lastMessage]);

  const onPickFile = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Выберите файл с расширением .json");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch("/api/pack", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setError(await readErrorDetail(res));
        return;
      }
      await refreshPackPreview();
      await refreshAdmin();
    } catch {
      setError("Не удалось отправить файл. Проверьте соединение и адрес API.");
    } finally {
      setUploading(false);
    }
  };

  const runAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        });
        if (!res.ok) {
          setError(await readErrorDetail(res));
          return;
        }
        await refreshAdmin();
      } catch {
        setError("Ошибка сети");
      } finally {
        setBusy(false);
      }
    },
    [refreshAdmin],
  );

  const onAdjust = useCallback(
    async (playerId: string, delta: number) => {
      await runAction("adjust_score", { player_id: playerId, delta });
    },
    [runAction],
  );

  const performReset = async () => {
    setResetConfirmOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) {
        setError(await readErrorDetail(res));
        return;
      }
      await refreshAdmin();
      await refreshPackPreview();
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusy(false);
    }
  };

  const preparation =
    admin != null && admin.pack != null && admin.current_round_index === null;
  const inGame = admin != null && admin.pack != null && admin.current_round_index !== null;

  const mainContent = () => {
    if (!admin) {
      return <p className="admin-muted">Загрузка состояния…</p>;
    }

    if (admin.status === "final") {
      return <FinalControl state={admin} busy={busy} onAction={runAction} />;
    }

    if (admin.status === "finished") {
      return (
        <div className="admin-panel">
          <p className="admin-finished-msg">Игра завершена.</p>
          <p className="admin-muted">Можно сбросить игру или начать заново после сброса.</p>
        </div>
      );
    }

    if (["question_open", "button_pressed", "answer_shown"].includes(admin.status)) {
      return <QuestionControl state={admin} busy={busy} onAction={runAction} />;
    }

    if (admin.status === "waiting" && admin.current_round && admin.current_round_index != null) {
      if (admin.current_round.is_final) {
        return (
          <p className="admin-muted">Ожидается статус финала — используйте панель после перехода.</p>
        );
      }
      return (
        <GameBoard
          round={admin.current_round}
          roundIndex={admin.current_round_index}
          played={admin.played}
          disabled={busy}
          onOpen={(theme, question) => {
            void runAction("open_question", {
              round: admin.current_round_index as number,
              theme,
              question,
            });
          }}
        />
      );
    }

    return <p className="admin-muted">Ожидание начала игры…</p>;
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1 className="admin-title">Ведущий — Свояк</h1>
        <div className="admin-header__actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="admin-file-input"
            onChange={onFileChange}
          />
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onPickFile} disabled={uploading || busy}>
            {uploading ? "Загрузка…" : "Загрузить пак"}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => {
              void refreshPackPreview();
              void refreshAdmin();
            }}
            disabled={loading || busy}
          >
            Обновить
          </button>
        </div>
      </header>

      {error ? (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      ) : null}

      <div className="admin-body">
        <div className="admin-main-col">
          {inGame ? (
            <div className="admin-topbar">
              <h2 className="admin-round-title">
                {admin?.current_round?.name ?? "Раунд"}
              </h2>
              <div className="admin-topbar__btns">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  disabled={busy || admin?.status === "finished"}
                  onClick={() => void runAction("next_round")}
                >
                  Следующий раунд
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  disabled={busy}
                  onClick={() => setResetConfirmOpen(true)}
                >
                  Сбросить игру
                </button>
              </div>
            </div>
          ) : null}

          {preparation ? (
            <section className="admin-section">
              <h2>Подготовка</h2>
              {pack ? (
                <>
                  <section className="admin-preview">
                    <h3>Превью пака</h3>
                    <ol className="admin-preview__rounds">
                      {pack.rounds.map((round, ri) => (
                        <li key={ri}>
                          <strong>{round.name}</strong>
                          {round.is_final ? (
                            <span className="admin-badge">финал</span>
                          ) : null}
                          <ul>
                            {round.themes.map((theme, ti) => (
                              <li key={ti}>
                                {theme.name} — {theme.questions.length} вопр., цены:{" "}
                                {formatPrices(theme.questions)}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={busy || !pack}
                    onClick={() => void runAction("start_game")}
                  >
                    Начать игру
                  </button>
                </>
              ) : (
                <p className="admin-muted">Загрузите пак вопросов.</p>
              )}
            </section>
          ) : null}

          {inGame ? <div className="admin-game-main">{mainContent()}</div> : null}

          {!inGame && !preparation && admin?.pack == null ? (
            <p className="admin-muted">Пак не загружен. Подключите JSON через «Загрузить пак».</p>
          ) : null}
        </div>

        <aside className="admin-sidebar">
          {admin ? <PlayerList state={admin} busy={busy} onAdjust={onAdjust} /> : null}
        </aside>
      </div>

      {loading && !uploading ? <span className="admin-loading-hint">Обновление…</span> : null}

      {resetConfirmOpen ? (
        <div
          className="admin-reset-dialog-backdrop"
          role="presentation"
          onClick={() => !busy && setResetConfirmOpen(false)}
        >
          <div
            className="admin-reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reset-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="admin-reset-dialog-title" className="admin-reset-dialog__text">
              Сбросить игру? Счёт обнулится, прогресс раундов и вопросов сбросится. Игроки останутся.
            </p>
            <div className="admin-reset-dialog__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                disabled={busy}
                onClick={() => setResetConfirmOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                disabled={busy}
                onClick={() => void performReset()}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
