import { useMemo, useState } from "react";
import {
  allPlayersSubmitted,
  type GameStateMessage,
  type Player as PlayerModel,
} from "../../types/game";

type Props = {
  state: GameStateMessage;
  player: PlayerModel;
  playerId: string;
};

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

export function FinalRound({ state, player, playerId }: Props) {
  const [betInput, setBetInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasBet = state.final_bets[playerId] === true;
  const hasAnswer = state.final_answers[playerId] === true;
  const allBets = allPlayersSubmitted(state.players, state.final_bets);

  const { minBet, maxBet, allIn } = useMemo(() => {
    const score = player.score;
    const min = 1;
    const max = Math.max(1, score);
    const va = Math.max(1, score);
    return { minBet: min, maxBet: max, allIn: va };
  }, [player.score]);

  const submitBetAndAnswer = async (bet: number) => {
    const text = answerInput.trim();
    if (!text) {
      setError("Введите ответ");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (bet < minBet || bet > maxBet) {
        throw new Error(`Ставка от ${minBet} до ${maxBet}`);
      }
      await postAction("submit_final_bet_and_answer", {
        player_id: playerId,
        bet,
        answer: text,
      });
      setBetInput("");
      setAnswerInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const onPlaceBet = () => {
    const n = parseInt(betInput, 10);
    if (Number.isNaN(n)) {
      setError("Введите число ставки");
      return;
    }
    void submitBetAndAnswer(n);
  };

  const onAllIn = () => {
    void submitBetAndAnswer(allIn);
  };

  const onSendAnswer = async () => {
    const text = answerInput.trim();
    if (!text) {
      setError("Введите ответ");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await postAction("submit_final_answer", { player_id: playerId, answer: text });
      setAnswerInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  if (!hasBet) {
    return (
      <div className="player-final">
        <div className="player-final__panel">
          <label className="player-final__label" htmlFor="bet">
            Твоя ставка
          </label>
          <input
            id="bet"
            className="player-final__input"
            type="number"
            inputMode="numeric"
            min={minBet}
            max={maxBet}
            value={betInput}
            onChange={(e) => setBetInput(e.target.value)}
            disabled={busy}
            placeholder={`${minBet}…${maxBet}`}
          />
          <label className="player-final__label" htmlFor="ans-bet">
            Твой ответ
          </label>
          <textarea
            id="ans-bet"
            className="player-final__textarea"
            rows={3}
            autoCapitalize="sentences"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={busy}
            placeholder="Свободная форма"
          />
          <div className="player-final__row">
            <button
              type="button"
              className="player-final__btn player-final__btn--secondary"
              disabled={busy}
              onClick={onAllIn}
            >
              Ва-банк ({allIn})
            </button>
            <button
              type="button"
              className="player-final__btn player-final__btn--primary"
              disabled={busy}
              onClick={onPlaceBet}
            >
              Отправить
            </button>
          </div>
        </div>
        {error ? <p className="player-final__error">{error}</p> : null}
      </div>
    );
  }

  if (!allBets) {
    return (
      <div className="player-final player-final--wait">
        <p className="player-final__wait-text">Ждём остальных...</p>
      </div>
    );
  }

  if (!hasAnswer) {
    return (
      <div className="player-final">
        <div className="player-final__panel">
          <label className="player-final__label" htmlFor="ans">
            Твой ответ
          </label>
          <input
            id="ans"
            className="player-final__input player-final__input--text"
            type="text"
            autoCapitalize="sentences"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            disabled={busy}
            placeholder="Введите ответ"
          />
          <button
            type="button"
            className="player-final__btn player-final__btn--primary player-final__btn--wide"
            disabled={busy}
            onClick={() => void onSendAnswer()}
          >
            Отправить
          </button>
        </div>
        {error ? <p className="player-final__error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="player-final player-final--wait">
      <p className="player-final__wait-text">Ждём остальных...</p>
    </div>
  );
}
