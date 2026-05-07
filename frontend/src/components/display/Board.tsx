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

/** Подпись столбца цен: берём цену из первой темы, у которой есть вопрос на этом уровне. */
function priceLabelForColumn(themes: GameRound["themes"], questionIndex: number): string {
  for (const t of themes) {
    const q = t.questions[questionIndex];
    if (q) {
      return formatPrice(q.price);
    }
  }
  return "—";
}

export function Board({ round, roundIndex, played }: Props) {
  const playedSet = new Set(played);
  const themes = round.themes;
  if (themes.length === 0) {
    return <div className="display-board display-board--empty">Нет тем в раунде</div>;
  }

  const priceColCount = Math.max(0, ...themes.map((t) => t.questions.length));
  if (priceColCount === 0) {
    return (
      <div className="display-board display-board--empty">Нет вопросов в темах</div>
    );
  }

  const gridTemplateColumns = `minmax(10rem, 1.15fr) repeat(${priceColCount}, minmax(0, 1fr))`;

  return (
    <div className="display-board">
      <div
        className="display-board__grid"
        style={{
          gridTemplateColumns,
        }}
      >
        <div className="display-board__corner" aria-hidden />

        {Array.from({ length: priceColCount }, (_, qi) => (
          <div key={`price-head-${qi}`} className="display-board__col-head">
            {priceLabelForColumn(themes, qi)}
          </div>
        ))}

        {themes.flatMap((theme, ti) => [
          <div key={`theme-${ti}`} className="display-board__theme">
            {theme.name}
          </div>,
          ...Array.from({ length: priceColCount }, (_, qi) => {
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
        ])}
      </div>
    </div>
  );
}
