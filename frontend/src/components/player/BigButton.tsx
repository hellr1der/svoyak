import type { ButtonHTMLAttributes } from "react";

export type BigButtonVariant =
  | "idle"
  | "active"
  | "blocked"
  | "your_turn"
  | "other_turn";

type Props = {
  variant: BigButtonVariant;
  label: string;
  /** Для other_turn — подпись под именем нажимавшего */
  sublabel?: string;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled">;

export function BigButton({ variant, label, sublabel, onClick, disabled }: Props) {
  const mod =
    variant === "active"
      ? "player-big-button--active"
      : variant === "your_turn"
        ? "player-big-button--your-turn"
        : variant === "other_turn"
          ? "player-big-button--other"
          : variant === "blocked"
            ? "player-big-button--blocked"
            : "player-big-button--idle";

  const isInteractive = variant === "active" && !disabled;

  return (
    <button
      type="button"
      className={`player-big-button ${mod}`}
      onClick={onClick}
      disabled={disabled ?? !isInteractive}
    >
      <span className="player-big-button__label">{label}</span>
      {sublabel ? <span className="player-big-button__sub">{sublabel}</span> : null}
    </button>
  );
}
