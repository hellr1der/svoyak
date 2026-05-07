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

function priceLabelForColumn(themes: GameRound["themes"], questionIndex: number): string {
  for (const t of themes) {
    const q = t.questions[questionIndex];
    if (q) {
      return formatPrice(q.price);
    }
  }
  return "—";
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

  const gridTemplateColumns = `minmax(7rem, 1.1fr) repeat(${priceColCount}, minmax(0, 1fr))`;

  return (
    <div className="admin-board">
      <div
        className="admin-board__grid"
        style={{
          gridTemplateColumns,
        }}
      >
        <div className="admin-board__corner" aria-hidden />

        {Array.from({ length: priceColCount }, (_, qi) => (
          <div key={`price-head-${qi}`} className="admin-board__col-head">
            {priceLabelForColumn(themes, qi)}
          </div>
        ))}

        {themes.flatMap((theme, ti) => [
          <div key={`theme-${ti}`} className="admin-board__theme">
            {theme.name}
          </div>,
          ...Array.from({ length: priceColCount }, (_, qi) => {
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
        ])}
      </div>
    </div>
  );
}
