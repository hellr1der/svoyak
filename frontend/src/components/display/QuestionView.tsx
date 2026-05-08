import type { GameQuestion } from "../../types/game";

type Variant = "question" | "answer";

type Props = {
  variant: Variant;
  data: GameQuestion;
  /** Угловая подпись цены (режим question) */
  priceText?: string | null;
  /** Подсветка имени (кто нажал кнопку) */
  buzzerName?: string | null;
  /** Уникальный ключ для анимации при смене контента */
  animKey: string;
};

function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return "";
  }
  return String(price);
}

function hasHttpUrl(s: string | null | undefined): boolean {
  if (!s) {
    return false;
  }
  return /^https?:\/\//i.test(s) || s.startsWith("/");
}

export function QuestionView({ variant, data, priceText, buzzerName, animKey }: Props) {
  const isQuestion = variant === "question";
  const text = isQuestion ? data.question : data.answer;
  const image = isQuestion ? data.question_image : data.answer_image;
  const showImage = hasHttpUrl(image ?? undefined);

  const corner =
    priceText != null && priceText !== ""
      ? priceText
      : isQuestion
        ? formatPrice(data.price) || null
        : null;

  return (
    <div className="display-question">
      {corner ? <div className="display-question__price-corner">{corner}</div> : null}

      <div
        key={animKey}
        className={
          "display-question__body display-question__body--anim" +
          (showImage ? " display-question__body--with-image" : "")
        }
      >
        {showImage ? (
          <div className="display-question__image-slot">
            <img
              className="display-question__image"
              src={image!}
              alt=""
              decoding="async"
            />
          </div>
        ) : null}
        <div className="display-question__text">{text}</div>
        {buzzerName ? (
          <div className="display-question__buzzer">{buzzerName}</div>
        ) : null}
      </div>
    </div>
  );
}
