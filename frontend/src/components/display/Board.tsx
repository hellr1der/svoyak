import { playedKey, type GameRound } from "../../types/game";

type Props = {
  round: GameRound;
  roundIndex: number;
  played: string[];
};

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return "—";
  }
  return String(price);
}

export function Board({ round, roundIndex, played }: Props) {
  const playedSet = new Set(played);
  const themes = round.themes;
  const colCount = themes.length;
  if (colCount === 0) {
    return <div className="display-board display-board--empty">Нет тем в раунде</div>;
  }

  const rowCount = Math.max(0, ...themes.map((t) => t.questions.length));

  return (
    <div className="display-board">
      <div
        className="display-board__grid"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {themes.map((theme, ti) => (
          <div key={ti} className="display-board__head">
            {theme.name}
          </div>
        ))}

        {Array.from({ length: rowCount }, (_, qi) =>
          themes.map((theme, ti) => {
            const q = theme.questions[qi];
            const key = playedKey(roundIndex, ti, qi);
            const isPlayed = !q || playedSet.has(key);

            return (
              <div
                key={`cell-${ti}-${qi}`}
                className={
                  isPlayed
                    ? "display-board__cell display-board__cell--played"
                    : "display-board__cell"
                }
              >
                {q && !isPlayed ? formatPrice(q.price) : ""}
              </div>
            );
          }),
        ).flat()}
      </div>
    </div>
  );
}
