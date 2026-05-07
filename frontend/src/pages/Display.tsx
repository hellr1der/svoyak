import { useMemo } from "react";
import { Board } from "../components/display/Board";
import { PlayerBar } from "../components/display/PlayerBar";
import { QuestionView } from "../components/display/QuestionView";
import { useWebSocket } from "../hooks/useWebSocket";
import type { GameStateMessage } from "../types/game";
import {
  allPlayersSubmitted,
  getFirstQuestionFromRound,
  parseGameState,
} from "../types/game";
import "./displayScreen.css";

function formatPriceLabel(price: number | null | undefined): string | null {
  if (price === null || price === undefined) {
    return null;
  }
  return String(price);
}

function DisplayBody({ state }: { state: GameStateMessage }) {
  const {
    status,
    pack,
    current_round,
    current_round_index,
    current_question,
    players,
    played,
    button_winner,
    final_bets,
    final_answers,
    current_theme_index,
    current_question_index,
  } = state;

  if (!pack) {
    return (
      <div className="display-idle">
        <p className="display-idle__text">Ожидание игры...</p>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="display-finished">
        <h2 className="display-finished__title">Игра завершена</h2>
      </div>
    );
  }

  const qAnimKey =
    current_theme_index != null && current_question_index != null
      ? `oq-${current_theme_index}-${current_question_index}-${status}`
      : `oq-${status}`;

  if (status === "question_open" && current_question) {
    return (
      <QuestionView
        variant="question"
        data={current_question}
        priceText={formatPriceLabel(current_question.price)}
        animKey={qAnimKey}
      />
    );
  }

  if (status === "button_pressed" && current_question) {
    return (
      <QuestionView
        variant="question"
        data={current_question}
        priceText={formatPriceLabel(current_question.price)}
        buzzerName={button_winner?.name ?? null}
        animKey={`${qAnimKey}-bz-${button_winner?.player_id ?? ""}`}
      />
    );
  }

  if (status === "answer_shown") {
    const q =
      current_question ??
      (current_round?.is_final ? getFirstQuestionFromRound(current_round) : null);
    if (q) {
      return (
        <QuestionView variant="answer" data={q} animKey={`ans-${qAnimKey}`} />
      );
    }
    return (
      <div className="display-idle">
        <p className="display-idle__text">Ожидание игры...</p>
      </div>
    );
  }

  if (status === "waiting") {
    if (current_round == null || current_round_index == null) {
      return (
        <div className="display-idle">
          <p className="display-idle__text">Ожидание игры...</p>
        </div>
      );
    }
    return (
      <div className="display-board-shell">
        <Board round={current_round} roundIndex={current_round_index} played={played} />
      </div>
    );
  }

  if (status === "final") {
    if (!current_round) {
      return (
        <div className="display-idle">
          <p className="display-idle__text">Финальный раунд</p>
        </div>
      );
    }

    const themeTitle = current_round.themes[0]?.name ?? current_round.name;
    const allBets = allPlayersSubmitted(players, final_bets);
    const allAnswers = allPlayersSubmitted(players, final_answers);
    const fq = getFirstQuestionFromRound(current_round);

    if (!allBets) {
      return (
        <div className="display-final display-final--bets">
          <h1 className="display-final__theme">{themeTitle}</h1>
          <p className="display-final__hint">Игроки делают ставки...</p>
        </div>
      );
    }

    if (allAnswers && fq) {
      return (
        <div className="display-final display-final--results">
          <p className="display-final__results-label">Итоги финала</p>
          <QuestionView variant="answer" data={fq} animKey={`final-result-${fq.answer.slice(0, 48)}`} />
        </div>
      );
    }

    if (fq) {
      const ptext = formatPriceLabel(fq.price) ?? "Финал";
      return (
        <QuestionView
          variant="question"
          data={fq}
          priceText={ptext}
          animKey={`final-q-${fq.question.slice(0, 48)}`}
        />
      );
    }

    return (
      <div className="display-idle">
        <p className="display-idle__text">{themeTitle}</p>
      </div>
    );
  }

  return (
    <div className="display-idle">
      <p className="display-idle__text">Ожидание игры...</p>
    </div>
  );
}

export function Display() {
  const { lastMessage, connected } = useWebSocket();
  const state = useMemo(() => parseGameState(lastMessage), [lastMessage]);

  return (
    <div className="display-root">
      <main className="display-main">
        {!connected ? (
          <div className="display-idle">
            <p className="display-idle__text">Подключение...</p>
          </div>
        ) : !state ? (
          <div className="display-idle">
            <p className="display-idle__text">Ожидание данных...</p>
          </div>
        ) : (
          <DisplayBody state={state} />
        )}
      </main>
      {state && state.players.length > 0 ? <PlayerBar players={state.players} /> : null}
    </div>
  );
}
