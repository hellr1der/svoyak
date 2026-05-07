import type { CSSProperties } from "react";
import { playedKey, type GameRound } from "../../types/game";

type Props = {
  round: GameRound;
  roundIndex: number;
  played: string[];
};

const BOARD_OUTER: CSSProperties = {
  background: "#0D1B6E",
  width: "100vw",
  height: "100vh",
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
};

const TABLE: CSSProperties = {
  width: "100%",
  height: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const TD_THEME: CSSProperties = {
  background: "#0D1B6E",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  textAlign: "center",
  padding: "10px 12px",
  border: "1.5px solid #1e2e8a",
  textTransform: "uppercase",
  width: "30%",
  lineHeight: 1.3,
};

const TD_PRICE: CSSProperties = {
  background: "#0D1B6E",
  color: "#fff",
  fontWeight: 900,
  fontSize: 32,
  textAlign: "center",
  border: "1.5px solid #1e2e8a",
};

const TD_PLAYED: CSSProperties = {
  background: "#0a1550",
  border: "1.5px solid #1e2e8a",
};

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return "—";
  }
  return String(price);
}

function priceLabelForColumn(themes: GameRound["themes"], questionIndex: number): string {
  for (const t of themes) {
    const q = t.questions[questionIndex];
    if (q) {
      return formatPrice(q.price);
    }
  }
  return "—";
}

/** Эквивалент «question.used»: ячейка на сервере помечена в `played` или вопроса нет. */
function isQuestionUsed(playedSet: Set<string>, roundIndex: number, themeIndex: number, questionIndex: number): boolean {
  const key = playedKey(roundIndex, themeIndex, questionIndex);
  return playedSet.has(key);
}

export function Board({ round, roundIndex, played }: Props) {
  const playedSet = new Set(played);
  const themes = round.themes;

  if (themes.length === 0) {
    return (
      <div className="display-board display-board--empty" style={{ ...BOARD_OUTER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Нет тем в раунде
      </div>
    );
  }

  const priceColCount = Math.max(0, ...themes.map((t) => t.questions.length));
  if (priceColCount === 0) {
    return (
      <div className="display-board display-board--empty" style={{ ...BOARD_OUTER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Нет вопросов в темах
      </div>
    );
  }

  return (
    <div className="display-board" style={BOARD_OUTER}>
      <table style={TABLE}>
        <tbody>
          <tr>
            <td style={TD_THEME} aria-hidden />
            {Array.from({ length: priceColCount }, (_, qi) => (
              <td key={`h-${qi}`} style={TD_PRICE}>
                {priceLabelForColumn(themes, qi)}
              </td>
            ))}
          </tr>
          {themes.map((theme, ti) => (
            <tr key={`theme-row-${ti}`}>
              <td style={TD_THEME}>{theme.name}</td>
              {Array.from({ length: priceColCount }, (_, qi) => {
                const q = theme.questions[qi];
                const used = !q || isQuestionUsed(playedSet, roundIndex, ti, qi);
                return (
                  <td key={`c-${ti}-${qi}`} style={used ? TD_PLAYED : TD_PRICE}>
                    {q && !used ? formatPrice(q.price) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
