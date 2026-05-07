import type { Player } from "../../types/game";

type Props = {
  players: Player[];
};

function byScoreDesc(a: Player, b: Player): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return a.name.localeCompare(b.name, "ru");
}

export function PlayerBar({ players }: Props) {
  const sorted = [...players].sort(byScoreDesc);

  return (
    <footer className="display-player-bar">
      {sorted.map((p) => (
        <div key={p.id} className="display-player-bar__item">
          <span className="display-player-bar__name">{p.name}</span>
          <span className="display-player-bar__score">{p.score}</span>
        </div>
      ))}
    </footer>
  );
}
