import { playedKey, type GameRound } from "../../types/game";

type Props = {
  round: GameRound;
  roundIndex: number;
  played: string[];
  disabled: boolean;
  onOpen: (themeIndex: number, questionIndex: number) => void;
};

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return "—";
  }
  return String(price);
}

export function GameBoard({ round, roundIndex, played, disabled, onOpen }: Props) {
  const playedSet = new Set(played);
  const themes = round.themes;
  const colCount = themes.length;
  if (colCount === 0) {
    return <div className="admin-board admin-board--empty">Нет тем в раунде</div>;
  }

  const rowCount = Math.max(0, ...themes.map((t) => t.questions.length));

  return (
    <div className="admin-board">
      <div
        className="admin-board__grid"
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {themes.map((theme, ti) => (
          <div key={ti} className="admin-board__head">
            {theme.name}
          </div>
        ))}

        {Array.from({ length: rowCount }, (_, qi) =>
          themes.map((theme, ti) => {
            const q = theme.questions[qi];
            const key = playedKey(roundIndex, ti, qi);
            const isPlayed = !q || playedSet.has(key);
            const canOpen = !!q && !isPlayed && !disabled;

            return (
              <div key={`cell-${ti}-${qi}`} className="admin-board__cell-wrap">
                {canOpen ? (
                  <button
                    type="button"
                    className="admin-board__cell admin-board__cell--open"
                    onClick={() => onOpen(ti, qi)}
                  >
                    {formatPrice(q!.price)}
                  </button>
                ) : (
                  <div
                    className={
                      isPlayed
                        ? "admin-board__cell admin-board__cell--played"
                        : "admin-board__cell admin-board__cell--disabled"
                    }
                  >
                    {q && !isPlayed ? formatPrice(q.price) : ""}
                  </div>
                )}
              </div>
            );
          }),
        ).flat()}
      </div>
    </div>
  );
}
