import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BigButton } from "../components/player/BigButton";
import { FinalRound } from "../components/player/FinalRound";
import { useWebSocket } from "../hooks/useWebSocket";
import { parseGameState, type GameStateMessage } from "../types/game";
import "./playerScreen.css";

const LS_ID = "svoyak_player_id";
const LS_NAME = "svoyak_player_name";

async function postAction(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const msg =
      detail && typeof detail === "object" && "detail" in detail
        ? String((detail as { detail: unknown }).detail)
        : res.statusText;
    throw new Error(msg);
  }
}

function JoinForm({
  onJoined,
}: {
  onJoined: (id: string, name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введи имя");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const msg =
          detail && typeof detail === "object" && "detail" in detail
            ? String((detail as { detail: unknown }).detail)
            : res.statusText;
        throw new Error(msg);
      }
      const data = (await res.json()) as { player_id: string; name: string };
      localStorage.setItem(LS_ID, data.player_id);
      localStorage.setItem(LS_NAME, data.name);
      onJoined(data.player_id, data.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="player-join">
      <form className="player-join__form" onSubmit={submit}>
        <label className="player-join__label" htmlFor="player-name">
          Введи своё имя
        </label>
        <input
          id="player-name"
          className="player-join__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoCapitalize="words"
          autoComplete="nickname"
          disabled={busy}
        />
        <button type="submit" className="player-join__submit" disabled={busy}>
          {busy ? "Вход…" : "Войти в игру"}
        </button>
        {error ? <p className="player-join__error">{error}</p> : null}
      </form>
    </div>
  );
}

function PlayerFooter({ name, score }: { name: string; score: number }) {
  return (
    <footer className="player-footer">
      <span className="player-footer__name">{name}</span>
      <span className="player-footer__score">{score}</span>
    </footer>
  );
}

export function Player() {
  const { lastMessage, connected } = useWebSocket();
  const state = useMemo(() => parseGameState(lastMessage), [lastMessage]);

  const [playerId, setPlayerId] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(LS_ID) : null,
  );
  const [sessionName, setSessionName] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(LS_NAME) : null,
  );
  const [optimisticPressed, setOptimisticPressed] = useState(false);

  useEffect(() => {
    if (!state || !playerId) {
      return;
    }
    const exists = state.players.some((p) => p.id === playerId);
    if (!exists) {
      localStorage.removeItem(LS_ID);
      localStorage.removeItem(LS_NAME);
      setPlayerId(null);
      setSessionName(null);
    }
  }, [state, playerId]);

  const qKey = useMemo(
    () =>
      state
        ? `${state.current_round_index ?? "-"}-${state.current_theme_index ?? "-"}-${state.current_question_index ?? "-"}`
        : "",
    [
      state?.current_round_index,
      state?.current_theme_index,
      state?.current_question_index,
    ],
  );

  useEffect(() => {
    setOptimisticPressed(false);
  }, [qKey]);

  useEffect(() => {
    if (!state) {
      return;
    }
    if (state.status === "button_pressed") {
      setOptimisticPressed(false);
    }
  }, [state?.status, state?.button_winner?.player_id]);

  const me = state?.players.find((p) => p.id === playerId) ?? null;
  const displayName = me?.name ?? sessionName ?? "Игрок";
  const displayScore = me?.score ?? 0;

  const onJoined = useCallback((id: string, name: string) => {
    setPlayerId(id);
    setSessionName(name);
  }, []);

  const onBuzz = useCallback(() => {
    if (!playerId || !state) {
      return;
    }
    setOptimisticPressed(true);
    void postAction("press_button", { player_id: playerId }).catch(() => {
      setOptimisticPressed(false);
    });
  }, [playerId, state]);

  const renderGame = (s: GameStateMessage) => {
    if (!playerId || !me) {
      return null;
    }

    if (s.status === "final") {
      return <FinalRound state={s} player={me} playerId={playerId} />;
    }

    if (s.status === "finished") {
      return (
        <div className="player-stage">
          <BigButton variant="idle" label="Игра окончена" />
        </div>
      );
    }

    const blocked = s.blocked_players.includes(playerId);

    if (s.status === "question_open") {
      if (optimisticPressed) {
        return (
          <div className="player-stage">
            <BigButton variant="idle" label="Жди" disabled />
          </div>
        );
      }
      if (blocked) {
        return (
          <div className="player-stage">
            <BigButton variant="blocked" label="Ты уже ответил" disabled />
          </div>
        );
      }
      return (
        <div className="player-stage">
          <BigButton variant="active" label="ЖАТЬ!" onClick={onBuzz} />
        </div>
      );
    }

    if (s.status === "button_pressed") {
      if (s.button_winner?.player_id === playerId) {
        return (
          <div className="player-stage">
            <BigButton variant="your_turn" label="Отвечай!" disabled />
          </div>
        );
      }
      return (
        <div className="player-stage">
          <BigButton
            variant="other_turn"
            label={s.button_winner?.name ?? "Другой игрок"}
            disabled
          />
        </div>
      );
    }

    // waiting, answer_shown — и «ждём» если заблокирован вне активного вопроса
    return (
      <div className="player-stage">
        <BigButton variant="idle" label="Жди вопроса" disabled />
      </div>
    );
  };

  if (!playerId) {
    return (
      <div className="player-root">
        <main className="player-main player-main--join">
          <JoinForm onJoined={onJoined} />
        </main>
      </div>
    );
  }

  return (
    <div className="player-root">
      <main className="player-main">
        {!connected ? (
          <p className="player-connecting">Подключение...</p>
        ) : !state ? (
          <p className="player-connecting">Загрузка...</p>
        ) : !me ? (
          <p className="player-connecting">Синхронизация...</p>
        ) : (
          renderGame(state)
        )}
      </main>
      <PlayerFooter name={displayName} score={displayScore} />
    </div>
  );
}
