import type { CSSProperties } from "react";
import { playedKey, type GameRound } from "../../types/game";

type Props = {
  round: GameRound;
  roundIndex: number;
  played: string[];
  disabled: boolean;
  onOpen: (themeIndex: number, questionIndex: number) => void;
};

const ADMIN_OUTER: CSSProperties = {
  background: "#0D1B6E",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
};

const TABLE: CSSProperties = {
  width: "100%",
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
  padding: 0,
  verticalAlign: "middle",
};

const TD_PLAYED: CSSProperties = {
  background: "#0a1550",
  border: "1.5px solid #1e2e8a",
  padding: 0,
  verticalAlign: "middle",
};

const TD_PRICE_DISABLED: CSSProperties = {
  ...TD_PRICE,
  color: "rgba(255, 255, 255, 0.35)",
};

const BTN_OPEN: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: "3.25rem",
  margin: 0,
  padding: "10px 8px",
  border: "none",
  background: "#0D1B6E",
  color: "#fff",
  font: "900 32px Arial, sans-serif",
  textAlign: "center",
  cursor: "pointer",
  boxSizing: "border-box",
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

function isQuestionUsed(playedSet: Set<string>, roundIndex: number, themeIndex: number, questionIndex: number): boolean {
  const key = playedKey(roundIndex, themeIndex, questionIndex);
  return playedSet.has(key);
}

export function GameBoard({ round, roundIndex, played, disabled, onOpen }: Props) {
  const playedSet = new Set(played);
  const themes = round.themes;

  if (themes.length === 0) {
    return <div className="admin-board admin-board--empty">Нет тем в раунде</div>;
  }

  const priceColCount = Math.max(0, ...themes.map((t) => t.questions.length));
  if (priceColCount === 0) {
    return <div className="admin-board admin-board--empty">Нет вопросов в темах</div>;
  }

  return (
    <div className="admin-board" style={ADMIN_OUTER}>
      <table style={TABLE}>
        <tbody>
          <tr>
            <td style={TD_THEME} aria-hidden />
            {Array.from({ length: priceColCount }, (_, qi) => (
              <td key={`h-${qi}`} style={{ ...TD_PRICE, padding: "10px 12px" }}>
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
                const canOpen = !!q && !used && !disabled;

                if (used) {
                  return <td key={`c-${ti}-${qi}`} style={TD_PLAYED} />;
                }

                if (canOpen) {
                  return (
                    <td key={`c-${ti}-${qi}`} style={TD_PRICE}>
                      <button type="button" style={BTN_OPEN} onClick={() => onOpen(ti, qi)}>
                        {formatPrice(q!.price)}
                      </button>
                    </td>
                  );
                }

                return (
                  <td key={`c-${ti}-${qi}`} style={TD_PRICE_DISABLED}>
                    {q ? formatPrice(q.price) : ""}
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
