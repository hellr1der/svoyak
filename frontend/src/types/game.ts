export type GameStatus =
  | "waiting"
  | "question_open"
  | "button_pressed"
  | "answer_shown"
  | "final"
  | "finished";

export interface GameQuestion {
  price: number | null;
  question: string;
  question_image: string | null;
  question_audio?: string | null;
  answer: string;
  answer_image: string | null;
}

export interface GameTheme {
  name: string;
  questions: GameQuestion[];
}

export interface GameRound {
  name: string;
  themes: GameTheme[];
  is_final?: boolean;
}

export interface PackQuestionCell {
  price: number | null;
  played: boolean;
}

export interface PackTheme {
  name: string;
  questions: PackQuestionCell[];
}

export interface PackRound {
  name: string;
  is_final: boolean;
  themes: PackTheme[];
}

export interface PackStructure {
  rounds: PackRound[];
}

export interface ButtonWinner {
  player_id: string;
  name: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  is_connected: boolean;
}

export interface GameStateMessage {
  status: GameStatus;
  current_round: GameRound | null;
  current_question: GameQuestion | null;
  current_round_index: number | null;
  current_theme_index: number | null;
  current_question_index: number | null;
  players: Player[];
  button_winner: ButtonWinner | null;
  blocked_players: string[];
  played: string[];
  final_bets: Record<string, boolean>;
  final_answers: Record<string, boolean>;
  pack: PackStructure | null;
}

/** Полные ставки и ответы для панели ведущего (GET /api/admin/state). */
export interface AdminGameState extends Omit<GameStateMessage, "final_bets" | "final_answers"> {
  final_bets: Record<string, number>;
  final_answers: Record<string, string>;
  final_judged: string[];
}

const STATUSES: GameStatus[] = [
  "waiting",
  "question_open",
  "button_pressed",
  "answer_shown",
  "final",
  "finished",
];

export function parseGameState(raw: string | null): GameStateMessage | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return null;
    }
    const o = data as Record<string, unknown>;
    if (typeof o.status !== "string" || !STATUSES.includes(o.status as GameStatus)) {
      return null;
    }
    return data as GameStateMessage;
  } catch {
    return null;
  }
}

export function parseAdminGameState(data: unknown): AdminGameState | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.status !== "string" || !STATUSES.includes(o.status as GameStatus)) {
    return null;
  }
  if (!Array.isArray(o.final_judged)) {
    return null;
  }
  if (!o.final_bets || typeof o.final_bets !== "object") {
    return null;
  }
  if (!o.final_answers || typeof o.final_answers !== "object") {
    return null;
  }
  return data as AdminGameState;
}

/** Все игроки есть как ключи в объекте (ставки / ответы в админке). */
export function allPlayersKeyed(players: Player[], record: object): boolean {
  if (players.length === 0) {
    return false;
  }
  return players.every((p) => Object.prototype.hasOwnProperty.call(record, p.id));
}

export function playedKey(roundIndex: number, themeIndex: number, questionIndex: number): string {
  return `${roundIndex}-${themeIndex}-${questionIndex}`;
}

/** Типичный один финальный вопрос — первый во всех темах раунда. */
export function getFirstQuestionFromRound(round: GameRound): GameQuestion | null {
  for (const theme of round.themes) {
    const q = theme.questions[0];
    if (q) {
      return q;
    }
  }
  return null;
}

export function allPlayersSubmitted(
  players: Player[],
  flags: Record<string, boolean>,
): boolean {
  if (players.length === 0) {
    return false;
  }
  return players.every((p) => flags[p.id] === true);
}
