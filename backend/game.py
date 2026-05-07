"""Игровое состояние и модели пака вопросов."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field

StatusLiteral = Literal[
    "waiting",
    "question_open",
    "button_pressed",
    "answer_shown",
    "final",
    "finished",
]


class GameActionError(Exception):
    """Недопустимое действие в текущем состоянии игры."""

    pass


class Question(BaseModel):
    price: int | None
    question: str
    question_image: str | None = None
    answer: str
    answer_image: str | None = None


class Theme(BaseModel):
    name: str
    questions: list[Question] = Field(default_factory=list)


class Round(BaseModel):
    name: str
    themes: list[Theme] = Field(default_factory=list)
    is_final: bool = False


class Pack(BaseModel):
    rounds: list[Round] = Field(default_factory=list)


class Player(BaseModel):
    id: str
    name: str
    score: int = 0
    is_connected: bool = True


class GameState:
    """Хранит состояние игры в памяти."""

    def __init__(self) -> None:
        self.pack: Pack | None = None
        self.status: StatusLiteral = "waiting"
        self.current_round_index: int | None = None
        self.current_theme_index: int | None = None
        self.current_question_index: int | None = None
        self.played: list[str] = []
        self.players: dict[str, Player] = {}
        self.button_winner: str | None = None
        self.blocked_players: set[str] = set()
        self.final_bets: dict[str, int] = {}
        self.final_answers: dict[str, str] = {}
        self.final_judged: set[str] = set()

    @staticmethod
    def played_key(round_index: int, theme_index: int, question_index: int) -> str:
        return f"{round_index}-{theme_index}-{question_index}"

    def load_pack(self, pack: Pack) -> None:
        self.pack = pack
        self.status = "waiting"
        self.current_round_index = None
        self.current_theme_index = None
        self.current_question_index = None
        self.played.clear()
        self.button_winner = None
        self.blocked_players.clear()
        self.final_bets.clear()
        self.final_answers.clear()
        self.final_judged.clear()

    def join_player(self, name: str) -> Player:
        raw = name.strip() or "Игрок"
        pid = str(uuid.uuid4())
        player = Player(id=pid, name=raw, score=0, is_connected=True)
        self.players[pid] = player
        return player

    # --- actions ---

    def apply_action(self, action: str, payload: dict) -> None:
        match action:
            case "start_game":
                self._start_game()
            case "open_question":
                self._open_question(payload)
            case "press_button":
                self._press_button(payload)
            case "correct_answer":
                self._correct_answer()
            case "wrong_answer":
                self._wrong_answer()
            case "no_answer":
                self._no_answer()
            case "show_answer":
                self._show_answer()
            case "close_question":
                self._close_question()
            case "next_round":
                self._next_round()
            case "adjust_score":
                self._adjust_score(payload)
            case "submit_final_bet":
                self._submit_final_bet(payload)
            case "submit_final_answer":
                self._submit_final_answer(payload)
            case "judge_final_answer":
                self._judge_final_answer(payload)
            case "finish_game":
                self._finish_game()
            case _:
                raise GameActionError(f"Неизвестное действие: {action}")

    def reset_game(self) -> None:
        """Сброс прогресса: пак и игроки остаются, счёт обнуляется."""
        if self.pack is None:
            raise GameActionError("Пак не загружен")
        for p in self.players.values():
            p.score = 0
        self.status = "waiting"
        self.current_round_index = None
        self.current_theme_index = None
        self.current_question_index = None
        self.played.clear()
        self.button_winner = None
        self.blocked_players.clear()
        self.final_bets.clear()
        self.final_answers.clear()
        self.final_judged.clear()

    def _require_pack(self) -> Pack:
        if self.pack is None:
            raise GameActionError("Пак не загружен")
        return self.pack

    def _current_round_model(self) -> Round | None:
        pack = self.pack
        if pack is None or self.current_round_index is None:
            return None
        ri = self.current_round_index
        if ri < 0 or ri >= len(pack.rounds):
            return None
        return pack.rounds[ri]

    def _get_question_price(self) -> int | None:
        rnd = self._current_round_model()
        if (
            rnd is None
            or self.current_theme_index is None
            or self.current_question_index is None
        ):
            return None
        ti, qi = self.current_theme_index, self.current_question_index
        if ti < 0 or ti >= len(rnd.themes):
            return None
        th = rnd.themes[ti]
        if qi < 0 or qi >= len(th.questions):
            return None
        return th.questions[qi].price

    def _start_game(self) -> None:
        pack = self._require_pack()
        if not pack.rounds:
            raise GameActionError("В паке нет раундов")
        for p in self.players.values():
            p.score = 0
        self.played.clear()
        self.current_round_index = 0
        self.current_theme_index = None
        self.current_question_index = None
        self.button_winner = None
        self.blocked_players.clear()
        self.final_bets.clear()
        self.final_answers.clear()
        self.final_judged.clear()
        first = pack.rounds[0]
        self.status = "final" if first.is_final else "waiting"

    def _open_question(self, payload: dict) -> None:
        pack = self._require_pack()
        if self.status != "waiting":
            raise GameActionError("Сейчас нельзя открыть вопрос")
        if self.current_round_index is None:
            raise GameActionError("Игра не начата")
        cur = pack.rounds[self.current_round_index]
        if cur.is_final:
            raise GameActionError("В финале используйте сценарий ставок и ответов")
        try:
            r_idx = int(payload["round"])
            t_idx = int(payload["theme"])
            q_idx = int(payload["question"])
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: round, theme, question (числа)") from e
        if r_idx != self.current_round_index:
            raise GameActionError("Можно открыть вопрос только текущего раунда")
        if r_idx < 0 or r_idx >= len(pack.rounds):
            raise GameActionError("Некорректный раунд")
        rnd = pack.rounds[r_idx]
        if t_idx < 0 or t_idx >= len(rnd.themes):
            raise GameActionError("Некорректная тема")
        th = rnd.themes[t_idx]
        if q_idx < 0 or q_idx >= len(th.questions):
            raise GameActionError("Некорректный вопрос")
        key = self.played_key(r_idx, t_idx, q_idx)
        if key in self.played:
            raise GameActionError("Этот вопрос уже сыгран")
        self.current_theme_index = t_idx
        self.current_question_index = q_idx
        self.status = "question_open"
        self.button_winner = None
        self.blocked_players.clear()

    def _press_button(self, payload: dict) -> None:
        if self.status != "question_open":
            raise GameActionError("Сейчас нельзя нажать кнопку")
        try:
            pid = str(payload["player_id"])
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: player_id") from e
        if pid in self.blocked_players:
            raise GameActionError("Игрок заблокирован")
        if pid not in self.players:
            raise GameActionError("Неизвестный игрок")
        self.button_winner = pid
        self.blocked_players = {p for p in self.players if p != pid}
        self.status = "button_pressed"

    def _correct_answer(self) -> None:
        if self.status != "button_pressed" or not self.button_winner:
            raise GameActionError("Никто не отвечает сейчас")
        rnd = self._current_round_model()
        if rnd and rnd.is_final:
            raise GameActionError("В финале оценивайте ответы через judge_final_answer")
        price = self._get_question_price()
        if price is None:
            raise GameActionError("У вопроса нет цены — не удалось начислить очки")
        winner = self.players.get(self.button_winner)
        if not winner:
            raise GameActionError("Победитель не найден")
        winner.score += price
        self.button_winner = None
        self.blocked_players.clear()
        self.status = "answer_shown"

    def _wrong_answer(self) -> None:
        if self.status != "button_pressed" or not self.button_winner:
            raise GameActionError("Никто не отвечает сейчас")
        rnd = self._current_round_model()
        if rnd and rnd.is_final:
            raise GameActionError("В финале используйте judge_final_answer")
        price = self._get_question_price()
        if price is None:
            raise GameActionError("У вопроса нет цены")
        loser_id = self.button_winner
        loser = self.players.get(loser_id)
        if not loser:
            raise GameActionError("Игрок не найден")
        loser.score -= price
        self.button_winner = None
        self.blocked_players = {loser_id}
        self.status = "question_open"

    def _no_answer(self) -> None:
        if self.status not in ("question_open", "button_pressed"):
            raise GameActionError("Сейчас нельзя зафиксировать отсутствие ответа")
        self.button_winner = None
        self.blocked_players.clear()
        self.status = "answer_shown"

    def _show_answer(self) -> None:
        if self.status not in ("question_open", "button_pressed"):
            raise GameActionError("Сейчас нельзя показать ответ")
        self.button_winner = None
        self.blocked_players.clear()
        self.status = "answer_shown"

    def _close_question(self) -> None:
        if self.status != "answer_shown":
            raise GameActionError("Сначала покажите ответ или завершите вопрос")
        if (
            self.current_round_index is None
            or self.current_theme_index is None
            or self.current_question_index is None
        ):
            raise GameActionError("Нет активного вопроса")
        key = self.played_key(
            self.current_round_index,
            self.current_theme_index,
            self.current_question_index,
        )
        if key not in self.played:
            self.played.append(key)
        self.current_theme_index = None
        self.current_question_index = None
        self.button_winner = None
        self.blocked_players.clear()
        self.status = "waiting"

    def _next_round(self) -> None:
        pack = self._require_pack()
        if self.current_round_index is None:
            raise GameActionError("Игра не начата")
        if self.status == "finished":
            raise GameActionError("Игра уже завершена")
        if self.current_theme_index is not None or self.current_question_index is not None:
            raise GameActionError("Сначала закройте текущий вопрос")
        if self.status not in ("waiting", "final"):
            raise GameActionError("Сейчас нельзя перейти к следующему раунду")
        nxt = self.current_round_index + 1
        if nxt >= len(pack.rounds):
            self.status = "finished"
            return
        self.current_round_index = nxt
        nround = pack.rounds[nxt]
        if nround.is_final:
            self.final_bets.clear()
            self.final_answers.clear()
            self.final_judged.clear()
        self.status = "final" if nround.is_final else "waiting"

    def _adjust_score(self, payload: dict) -> None:
        try:
            pid = str(payload["player_id"])
            delta = int(payload["delta"])
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: player_id, delta") from e
        player = self.players.get(pid)
        if not player:
            raise GameActionError("Неизвестный игрок")
        player.score += delta

    def _submit_final_bet(self, payload: dict) -> None:
        if self.status != "final":
            raise GameActionError("Ставки принимаются только в финале")
        try:
            pid = str(payload["player_id"])
            bet = int(payload["bet"])
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: player_id, bet") from e
        if pid not in self.players:
            raise GameActionError("Неизвестный игрок")
        if bet < 1:
            raise GameActionError("Ставка не меньше 1")
        player = self.players[pid]
        max_bet = max(1, player.score)
        if bet > max_bet:
            raise GameActionError("Ставка не может превышать счёт игрока")
        self.final_bets[pid] = bet

    def _submit_final_answer(self, payload: dict) -> None:
        if self.status != "final":
            raise GameActionError("Ответы принимаются только в финале")
        try:
            pid = str(payload["player_id"])
            answer = str(payload["answer"])
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: player_id, answer") from e
        if pid not in self.players:
            raise GameActionError("Неизвестный игрок")
        self.final_answers[pid] = answer

    def _judge_final_answer(self, payload: dict) -> None:
        if self.status != "final":
            raise GameActionError("Оценка только в финале")
        try:
            pid = str(payload["player_id"])
            correct = payload["correct"]
        except (KeyError, TypeError, ValueError) as e:
            raise GameActionError("Ожидается payload: player_id, correct (bool)") from e
        if not isinstance(correct, bool):
            raise GameActionError("Поле correct должно быть true или false")
        player = self.players.get(pid)
        if not player:
            raise GameActionError("Неизвестный игрок")
        if pid not in self.final_bets:
            raise GameActionError("У игрока нет ставки")
        if pid in self.final_judged:
            raise GameActionError("Ответ этого игрока уже оценён")
        bet = self.final_bets[pid]
        if correct:
            player.score += bet
        else:
            player.score -= bet
        self.final_judged.add(pid)

    def _finish_game(self) -> None:
        self.status = "finished"
        self.current_theme_index = None
        self.current_question_index = None
        self.button_winner = None
        self.blocked_players.clear()

    # --- serialization ---

    def _pack_structure_only(self, played_set: set[str]) -> dict | None:
        if self.pack is None:
            return None
        rounds_out: list[dict] = []
        for ri, rnd in enumerate(self.pack.rounds):
            themes_out: list[dict] = []
            for ti, theme in enumerate(rnd.themes):
                qs = []
                for qi, q in enumerate(theme.questions):
                    key = self.played_key(ri, ti, qi)
                    qs.append({"price": q.price, "played": key in played_set})
                themes_out.append({"name": theme.name, "questions": qs})
            rounds_out.append(
                {
                    "name": rnd.name,
                    "is_final": rnd.is_final,
                    "themes": themes_out,
                }
            )
        return {"rounds": rounds_out}

    def _button_winner_public(self) -> dict | None:
        if not self.button_winner:
            return None
        p = self.players.get(self.button_winner)
        if not p:
            return {"player_id": self.button_winner, "name": "?"}
        return {"player_id": p.id, "name": p.name}

    def _current_round_dict(self) -> dict | None:
        rnd = self._current_round_model()
        return rnd.model_dump() if rnd else None

    def _current_question_dict(self) -> dict | None:
        pack = self.pack
        if pack is None or self.current_round_index is None:
            return None
        if self.current_theme_index is None or self.current_question_index is None:
            return None
        rnd = pack.rounds[self.current_round_index]
        ti, qi = self.current_theme_index, self.current_question_index
        if ti < 0 or ti >= len(rnd.themes):
            return None
        th = rnd.themes[ti]
        if qi < 0 or qi >= len(th.questions):
            return None
        return th.questions[qi].model_dump()

    def to_broadcast_dict(self) -> dict:
        played_set = set(self.played)
        return {
            "status": self.status,
            "current_round": self._current_round_dict(),
            "current_question": self._current_question_dict(),
            "current_round_index": self.current_round_index,
            "current_theme_index": self.current_theme_index,
            "current_question_index": self.current_question_index,
            "players": [
                p.model_dump()
                for p in sorted(self.players.values(), key=lambda x: (x.name.lower(), x.id))
            ],
            "button_winner": self._button_winner_public(),
            "blocked_players": sorted(self.blocked_players),
            "played": list(self.played),
            "final_bets": {pid: True for pid in self.final_bets},
            "final_answers": {pid: True for pid in self.final_answers},
            "pack": self._pack_structure_only(played_set),
        }

    def to_admin_dict(self) -> dict:
        """Состояние для ведущего: реальные ставки и ответы, список оценённых."""
        d = self.to_broadcast_dict()
        d["final_bets"] = dict(self.final_bets)
        d["final_answers"] = dict(self.final_answers)
        d["final_judged"] = sorted(self.final_judged)
        return d

    def to_dict(self) -> dict:
        """Полное состояние для клиентов (как broadcast)."""
        return self.to_broadcast_dict()
