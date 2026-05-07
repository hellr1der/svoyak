import {
  allPlayersKeyed,
  getFirstQuestionFromRound,
  type AdminGameState,
} from "../../types/game";

function imgSrc(url: string | null): string | null {
  if (!url) {
    return null;
  }
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
    return url;
  }
  return null;
}

type Props = {
  state: AdminGameState;
  busy: boolean;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
};

export function FinalControl({ state, busy, onAction }: Props) {
  const round = state.current_round;
  const fq = round ? getFirstQuestionFromRound(round) : null;
  const players = state.players;
  const allBetsIn = allPlayersKeyed(players, state.final_bets);
  const allAnswersIn = allPlayersKeyed(players, state.final_answers);
  const judged = new Set(state.final_judged);

  return (
    <div className="admin-final">
      <h3 className="admin-final__title">Финальный раунд</h3>

      <div className="admin-final__bets-block">
        <h4 className="admin-final__subtitle">Ставки</h4>
        <ul className="admin-final__bet-list">
          {players.map((p) => {
            const submitted = Object.prototype.hasOwnProperty.call(state.final_bets, p.id);
            const amount = submitted ? state.final_bets[p.id] : null;
            return (
              <li key={p.id}>
                <span>{p.name}</span>
                {!allBetsIn ? (
                  <span className={submitted ? "admin-tag admin-tag--ok" : "admin-tag"}>
                    {submitted ? "сдал" : "не сдал"}
                  </span>
                ) : (
                  <span className="admin-final__amount">{amount ?? "—"}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {allBetsIn && fq ? (
        <div className="admin-final__q">
          <p className="admin-final__q-text">{fq.question}</p>
          {imgSrc(fq.question_image) ? (
            <img
              className="admin-final__img"
              src={imgSrc(fq.question_image)!}
              alt=""
            />
          ) : null}
          <div className="admin-final__answer">
            <strong>Правильный ответ:</strong> {fq.answer}
            {imgSrc(fq.answer_image) ? (
              <img
                className="admin-final__img"
                src={imgSrc(fq.answer_image)!}
                alt=""
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {allAnswersIn ? (
        <div className="admin-final__answers">
          <h4 className="admin-final__subtitle">Ответы игроков</h4>
          <ul className="admin-final__answer-cards">
            {players.map((p) => {
              const text = state.final_answers[p.id];
              const done = judged.has(p.id);
              return (
                <li key={p.id} className="admin-final__answer-card">
                  <div className="admin-final__answer-head">
                    <strong>{p.name}</strong>
                    {done ? <span className="admin-tag admin-tag--ok">оценено</span> : null}
                  </div>
                  <p className="admin-final__answer-text">
                    {text !== undefined ? text : "—"}
                  </p>
                  {!done && text !== undefined ? (
                    <div className="admin-final__judge">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ok"
                        disabled={busy}
                        onClick={() =>
                          onAction("judge_final_answer", {
                            player_id: p.id,
                            correct: true,
                          })
                        }
                      >
                        Верно ✓
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--bad"
                        disabled={busy}
                        onClick={() =>
                          onAction("judge_final_answer", {
                            player_id: p.id,
                            correct: false,
                          })
                        }
                      >
                        Неверно ✗
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : allBetsIn ? (
        <p className="admin-final__hint">Ожидаем ответы игроков…</p>
      ) : null}

      <div className="admin-final__finish-row">
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          disabled={busy}
          onClick={() => onAction("finish_game")}
        >
          Завершить игру
        </button>
      </div>
    </div>
  );
}
