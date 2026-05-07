import type { AdminGameState } from "../../types/game";

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

export function QuestionControl({ state, busy, onAction }: Props) {
  const q = state.current_question;
  const st = state.status;

  if (st === "question_open" && q) {
    const qi = imgSrc(q.question_image);
    return (
      <div className="admin-question">
        <div className="admin-question__meta">
          {q.price != null ? <span className="admin-question__price">Цена: {q.price}</span> : null}
        </div>
        {qi ? <img className="admin-question__img" src={qi} alt="" /> : null}
        <p className="admin-question__text">{q.question}</p>
        <div className="admin-question__answer-box">
          <span className="admin-question__answer-label">Ответ:</span>
          <p className="admin-question__answer">{q.answer}</p>
          {imgSrc(q.answer_image) ? (
            <img className="admin-question__img" src={imgSrc(q.answer_image)!} alt="" />
          ) : null}
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          disabled={busy}
          onClick={() => onAction("no_answer")}
        >
          Никто не ответил
        </button>
        <PlayerLockStatus state={state} />
      </div>
    );
  }

  if (st === "button_pressed" && q) {
    const qi = imgSrc(q.question_image);
    return (
      <div className="admin-question">
        <p className="admin-question__buzzer">
          {state.button_winner?.name ?? "Игрок"} нажал первым
        </p>
        {qi ? <img className="admin-question__img" src={qi} alt="" /> : null}
        <p className="admin-question__text">{q.question}</p>
        <div className="admin-question__answer-box">
          <span className="admin-question__answer-label">Ответ:</span>
          <p className="admin-question__answer">{q.answer}</p>
        </div>
        <div className="admin-question__actions">
          <button
            type="button"
            className="admin-btn admin-btn--ok"
            disabled={busy}
            onClick={() => onAction("correct_answer")}
          >
            Верно ✓
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--bad"
            disabled={busy}
            onClick={() => onAction("wrong_answer")}
          >
            Неверно ✗
          </button>
        </div>
        <PlayerLockStatus state={state} />
      </div>
    );
  }

  if (st === "answer_shown" && q) {
    const qi = imgSrc(q.question_image);
    const ai = imgSrc(q.answer_image);
    return (
      <div className="admin-question">
        {qi ? <img className="admin-question__img" src={qi} alt="" /> : null}
        <p className="admin-question__text">{q.question}</p>
        {ai ? <img className="admin-question__img" src={ai} alt="" /> : null}
        <div className="admin-question__answer-box">
          <span className="admin-question__answer-label">Ответ:</span>
          <p className="admin-question__answer">{q.answer}</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={() => onAction("close_question")}
        >
          Закрыть вопрос
        </button>
      </div>
    );
  }

  return (
    <div className="admin-question admin-question--empty">
      Нет активного вопроса для этого статуса.
    </div>
  );
}

function PlayerLockStatus({ state }: { state: AdminGameState }) {
  const blocked = new Set(state.blocked_players);
  return (
    <div className="admin-lock-status">
      <h4 className="admin-lock-status__title">Игроки</h4>
      <ul className="admin-lock-status__list">
        {state.players.map((p) => (
          <li key={p.id}>
            <span className="admin-lock-status__name">{p.name}</span>
            <span
              className={
                blocked.has(p.id)
                  ? "admin-lock-status__tag admin-lock-status__tag--blocked"
                  : "admin-lock-status__tag admin-lock-status__tag--active"
              }
            >
              {blocked.has(p.id) ? "заблокирован" : "активен"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
