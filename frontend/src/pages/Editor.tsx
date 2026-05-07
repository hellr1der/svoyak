import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import "./editorScreen.css";

type DraftQuestion = {
  _key: string;
  price: number | null;
  question: string;
  question_image: string | null;
  question_audio: string | null;
  answer: string;
  answer_image: string | null;
};

type DraftTheme = {
  _key: string;
  name: string;
  questions: DraftQuestion[];
};

type DraftRound = {
  _key: string;
  name: string;
  is_final: boolean;
  themes: DraftTheme[];
};

type DraftPack = { rounds: DraftRound[] };

function newKey(): string {
  return crypto.randomUUID();
}

function emptyQuestion(price: number): DraftQuestion {
  return {
    _key: newKey(),
    price,
    question: "",
    question_image: null,
    question_audio: null,
    answer: "",
    answer_image: null,
  };
}

function emptyTheme(): DraftTheme {
  return {
    _key: newKey(),
    name: "Новая тема",
    questions: [],
  };
}

function emptyRound(name: string, isFinal: boolean): DraftRound {
  return {
    _key: newKey(),
    name,
    is_final: isFinal,
    themes: [],
  };
}

function normalizeQuestion(q: Record<string, unknown>): DraftQuestion {
  const price = q.price;
  return {
    _key: newKey(),
    price: typeof price === "number" ? price : price === null ? null : Number(price) || null,
    question: String(q.question ?? ""),
    question_image: (q.question_image as string | null) ?? null,
    question_audio: (q.question_audio as string | null) ?? null,
    answer: String(q.answer ?? ""),
    answer_image: (q.answer_image as string | null) ?? null,
  };
}

function apiToDraft(data: unknown): DraftPack {
  if (!data || typeof data !== "object" || !("rounds" in data)) {
    return { rounds: [] };
  }
  const roundsRaw = (data as { rounds: unknown }).rounds;
  if (!Array.isArray(roundsRaw)) {
    return { rounds: [] };
  }
  const rounds: DraftRound[] = roundsRaw.map((r) => {
    const o = r as Record<string, unknown>;
    const themesRaw = Array.isArray(o.themes) ? o.themes : [];
    const themes: DraftTheme[] = themesRaw.map((t) => {
      const th = t as Record<string, unknown>;
      const qs = Array.isArray(th.questions) ? th.questions : [];
      return {
        _key: newKey(),
        name: String(th.name ?? "Тема"),
        questions: qs.map((q) => normalizeQuestion(q as Record<string, unknown>)),
      };
    });
    return {
      _key: newKey(),
      name: String(o.name ?? "Раунд"),
      is_final: Boolean(o.is_final),
      themes,
    };
  });
  return { rounds };
}

function draftToPayload(draft: DraftPack): { rounds: unknown[] } {
  return {
    rounds: draft.rounds.map((r) => ({
      name: r.name,
      is_final: r.is_final,
      themes: r.themes.map((t) => ({
        name: t.name,
        questions: t.questions.map((q) => ({
          price: q.price,
          question: q.question,
          question_image: q.question_image,
          question_audio: q.question_audio,
          answer: q.answer,
          answer_image: q.answer_image,
        })),
      })),
    })),
  };
}

function findQuestionLoc(pack: DraftPack, qKey: string): { ri: number; ti: number; qi: number } | null {
  for (let ri = 0; ri < pack.rounds.length; ri++) {
    const themes = pack.rounds[ri].themes;
    for (let ti = 0; ti < themes.length; ti++) {
      const qi = themes[ti].questions.findIndex((q) => q._key === qKey);
      if (qi >= 0) return { ri, ti, qi };
    }
  }
  return null;
}

function findRoundIndex(pack: DraftPack, rk: string): number {
  return pack.rounds.findIndex((r) => r._key === rk);
}

function findThemeIndex(round: DraftRound, tk: string): number {
  return round.themes.findIndex((t) => t._key === tk);
}

type DeleteTarget =
  | { kind: "round"; rk: string }
  | { kind: "theme"; rk: string; tk: string }
  | { kind: "question"; rk: string; tk: string; qk: string };

type QuestionModalState = { rk: string; tk: string; qk: string };

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "detail" in data) {
      const d = (data as { detail: unknown }).detail;
      return typeof d === "string" ? d : JSON.stringify(d);
    }
  } catch {
    /* ignore */
  }
  return res.statusText || String(res.status);
}

function SortableRoundWrap({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableThemeWrap({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function SortableQuestionWrap({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.62 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function ThemeDropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 12,
        marginTop: 2,
        border: isOver ? "1.5px dashed #4a6aff" : "1.5px dashed #1e2e8a33",
        background: isOver ? "rgba(74,106,255,0.12)" : "transparent",
      }}
    />
  );
}

export function Editor() {
  const [draft, setDraft] = useState<DraftPack>({ rounds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(() => new Set());
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(() => new Set());
  const [renameRound, setRenameRound] = useState<string | null>(null);
  const [renameTheme, setRenameTheme] = useState<{ rk: string; tk: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [questionModal, setQuestionModal] = useState<QuestionModalState | null>(null);
  const [newRoundIsFinal, setNewRoundIsFinal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const loadPack = useCallback(async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/pack");
      if (res.status === 404) {
        setDraft({ rounds: [] });
        setExpandedRounds(new Set());
        setExpandedThemes(new Set());
        return;
      }
      if (!res.ok) {
        setStatusMsg({ kind: "err", text: await readErrorDetail(res) });
        setDraft({ rounds: [] });
        return;
      }
      const data: unknown = await res.json();
      const d = apiToDraft(data);
      setDraft(d);
      setExpandedRounds(new Set(d.rounds.map((r) => r._key)));
      const ts = new Set<string>();
      for (const r of d.rounds) {
        for (const t of r.themes) {
          ts.add(`${r._key}|${t._key}`);
        }
      }
      setExpandedThemes(ts);
    } catch {
      setStatusMsg({ kind: "err", text: "Не удалось загрузить пак" });
      setDraft({ rounds: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPack();
  }, [loadPack]);

  const roundIds = useMemo(() => draft.rounds.map((r) => r._key), [draft.rounds]);

  const toggleRound = (rk: string) => {
    setExpandedRounds((prev) => {
      const n = new Set(prev);
      if (n.has(rk)) n.delete(rk);
      else n.add(rk);
      return n;
    });
  };

  const toggleTheme = (rk: string, tk: string) => {
    const id = `${rk}|${tk}`;
    setExpandedThemes((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const addRound = () => {
    const n = draft.rounds.length + 1;
    const name = newRoundIsFinal ? "Финал" : `Раунд ${n}`;
    const r = emptyRound(name, newRoundIsFinal);
    setDraft((p) => ({ rounds: [...p.rounds, r] }));
    setExpandedRounds((s) => new Set(s).add(r._key));
    setNewRoundIsFinal(false);
  };

  const addTheme = (rk: string) => {
    const t = emptyTheme();
    const tk = t._key;
    setDraft((p) => {
      const ri = findRoundIndex(p, rk);
      if (ri < 0) return p;
      const next: DraftPack = {
        rounds: p.rounds.map((row, i) =>
          i === ri ? { ...row, themes: [...row.themes, t] } : row,
        ),
      };
      return next;
    });
    setExpandedThemes((s) => new Set(s).add(`${rk}|${tk}`));
  };

  const addQuestion = (rk: string, tk: string) => {
    let addedKey = "";
    setDraft((p) => {
      const ri = findRoundIndex(p, rk);
      if (ri < 0) return p;
      const ti = findThemeIndex(p.rounds[ri], tk);
      if (ti < 0) return p;
      const qs = p.rounds[ri].themes[ti].questions;
      const price = (qs.length + 1) * 100;
      const q = emptyQuestion(price);
      addedKey = q._key;
      return {
        rounds: p.rounds.map((row, i) => {
          if (i !== ri) return row;
          return {
            ...row,
            themes: row.themes.map((th, j) =>
              j === ti ? { ...th, questions: [...th.questions, q] } : th,
            ),
          };
        }),
      };
    });
    if (addedKey) {
      setQuestionModal({ rk, tk, qk: addedKey });
    }
  };

  const downloadJson = () => {
    const payload = draftToPayload(draft);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pack.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToServer = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const body = draftToPayload(draft);
      const res = await fetch("/api/pack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setStatusMsg({ kind: "err", text: await readErrorDetail(res) });
        return;
      }
      setStatusMsg({ kind: "ok", text: "Сохранено на сервере." });
      await loadPack();
    } catch {
      setStatusMsg({ kind: "err", text: "Ошибка сети при сохранении" });
    } finally {
      setSaving(false);
    }
  };

  const applyDelete = () => {
    if (!deleteTarget) return;
    const t = deleteTarget;
    setDeleteTarget(null);
    setDraft((p) => {
      if (t.kind === "round") {
        const rk = t.rk;
        return {
          rounds: p.rounds.filter((r) => r._key !== rk),
        };
      }
      if (t.kind === "theme") {
        const { rk, tk } = t;
        return {
          rounds: p.rounds.map((r) =>
            r._key !== rk ? r : { ...r, themes: r.themes.filter((th) => th._key !== tk) },
          ),
        };
      }
      const { rk, tk, qk } = t;
      return {
        rounds: p.rounds.map((r) => {
          if (r._key !== rk) return r;
          return {
            ...r,
            themes: r.themes.map((th) => {
              if (th._key !== tk) return th;
              return { ...th, questions: th.questions.filter((q) => q._key !== qk) };
            }),
          };
        }),
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const aid = String(active.id);
    const oid = String(over.id);

    if (roundIds.includes(aid) && roundIds.includes(oid)) {
      setDraft((p) => {
        const oldIndex = p.rounds.findIndex((r) => r._key === aid);
        const newIndex = p.rounds.findIndex((r) => r._key === oid);
        if (oldIndex < 0 || newIndex < 0) return p;
        return { rounds: arrayMove(p.rounds, oldIndex, newIndex) };
      });
      return;
    }

    if (aid.startsWith("theme:")) {
      const activeThemeKey = aid.slice("theme:".length);
      let overThemeKey = oid.startsWith("theme:") ? oid.slice("theme:".length) : null;
      if (!overThemeKey && oid.startsWith("drop:")) {
        const rest = oid.slice("drop:".length);
        const sep = rest.indexOf(":");
        if (sep >= 0) {
          overThemeKey = rest.slice(sep + 1);
        }
      }
      if (!overThemeKey) return;

      setDraft((p) => {
        let sRi = -1;
        for (let ri = 0; ri < p.rounds.length; ri++) {
          const ti = findThemeIndex(p.rounds[ri], activeThemeKey);
          if (ti >= 0) {
            sRi = ri;
            break;
          }
        }
        if (sRi < 0) return p;

        let dRi = -1;
        for (let ri = 0; ri < p.rounds.length; ri++) {
          const ti = findThemeIndex(p.rounds[ri], overThemeKey!);
          if (ti >= 0) {
            dRi = ri;
            break;
          }
        }
        if (dRi < 0) return p;
        if (sRi !== dRi) return p;

        const themes = p.rounds[sRi].themes;
        const oldIndex = themes.findIndex((t) => t._key === activeThemeKey);
        const newIndex = themes.findIndex((t) => t._key === overThemeKey);
        if (oldIndex < 0 || newIndex < 0) return p;
        return {
          rounds: p.rounds.map((r, i) =>
            i !== sRi ? r : { ...r, themes: arrayMove(r.themes, oldIndex, newIndex) },
          ),
        };
      });
      return;
    }

    if (aid.startsWith("q:")) {
      const qk = aid.slice(2);
      setDraft((p) => {
        const from = findQuestionLoc(p, qk);
        if (!from) return p;
        let toRi = from.ri;
        let toTi = from.ti;
        let toQi = from.qi;

        if (oid.startsWith("q:")) {
          const to = findQuestionLoc(p, oid.slice(2));
          if (!to) return p;
          toRi = to.ri;
          toTi = to.ti;
          toQi = to.qi;
        } else if (oid.startsWith("drop:")) {
          const rest = oid.slice("drop:".length);
          const [brk, btk] = rest.split(":");
          const ri = findRoundIndex(p, brk);
          if (ri < 0) return p;
          const ti = findThemeIndex(p.rounds[ri], btk);
          if (ti < 0) return p;
          toRi = ri;
          toTi = ti;
          toQi = p.rounds[ri].themes[ti].questions.length;
        } else return p;

        const next: DraftPack = {
          rounds: p.rounds.map((r) => ({
            ...r,
            themes: r.themes.map((th) => ({ ...th, questions: [...th.questions] })),
          })),
        };
        const moved = next.rounds[from.ri].themes[from.ti].questions[from.qi];
        next.rounds[from.ri].themes[from.ti].questions.splice(from.qi, 1);

        let insertAt = toQi;
        if (from.ri === toRi && from.ti === toTi && from.qi < toQi) {
          insertAt = toQi - 1;
        }
        next.rounds[toRi].themes[toTi].questions.splice(insertAt, 0, moved);
        return next;
      });
    }
  };

  const openQuestionModal = (rk: string, tk: string, qk: string) => {
    setQuestionModal({ rk, tk, qk });
  };

  const getQuestionRef = (): DraftQuestion | null => {
    if (!questionModal) return null;
    const { rk, tk, qk } = questionModal;
    const ri = findRoundIndex(draft, rk);
    if (ri < 0) return null;
    const ti = findThemeIndex(draft.rounds[ri], tk);
    if (ti < 0) return null;
    return draft.rounds[ri].themes[ti].questions.find((q) => q._key === qk) ?? null;
  };

  const updateQuestionField = (field: keyof DraftQuestion, value: string | number | null) => {
    if (!questionModal) return;
    const { rk, tk, qk } = questionModal;
    setDraft((p) => ({
      rounds: p.rounds.map((r) =>
        r._key !== rk
          ? r
          : {
              ...r,
              themes: r.themes.map((th) =>
                th._key !== tk
                  ? th
                  : {
                      ...th,
                      questions: th.questions.map((q) =>
                        q._key !== qk ? q : { ...q, [field]: value },
                      ),
                    },
              ),
            },
      ),
    }));
  };

  const qRef = questionModal ? getQuestionRef() : null;

  if (loading) {
    return (
      <div className="editor-page">
        <p className="editor-loading">Загрузка пака…</p>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <h1 className="editor-title">Редактор пака</h1>
        <div className="editor-header__actions">
          <button type="button" className="editor-btn editor-btn--secondary" onClick={downloadJson}>
            Скачать JSON
          </button>
          <button type="button" className="editor-btn" onClick={() => void saveToServer()} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить на сервер"}
          </button>
        </div>
      </header>

      {statusMsg ? (
        <div className={statusMsg.kind === "ok" ? "editor-msg editor-msg--ok" : "editor-msg editor-msg--err"}>
          {statusMsg.text}
        </div>
      ) : null}

      <p className="editor-note">
        Если пак ещё не загружен на сервере (404), создайте раунды и сохраните. Текущее состояние игры после
        сохранения обновится из файла pack.json на сервере.
      </p>

      <div className="editor-tools">
        <div className="checkbox-row" style={{ marginBottom: 8 }}>
          <input
            id="new-round-final"
            type="checkbox"
            checked={newRoundIsFinal}
            onChange={(e) => setNewRoundIsFinal(e.target.checked)}
          />
          <label htmlFor="new-round-final">Новый раунд — финал (is_final)</label>
        </div>
        <button type="button" className="editor-btn" onClick={addRound}>
          + Добавить раунд
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <SortableContext items={roundIds} strategy={verticalListSortingStrategy}>
          {draft.rounds.map((round) => {
            const rk = round._key;
            const themeIds = round.themes.map((t) => `theme:${t._key}`);
            const openR = expandedRounds.has(rk);

            return (
              <SortableRoundWrap key={rk} id={rk}>
                <div className="editor-round">
                  <div className="editor-round__head">
                    <button type="button" className="editor-round__toggle" onClick={() => toggleRound(rk)}>
                      {openR ? "▼" : "▶"}
                    </button>
                    {renameRound === rk ? (
                      <input
                        className="editor-inline-input"
                        autoFocus
                        defaultValue={round.name}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || "Раунд";
                          setDraft((p) => ({
                            rounds: p.rounds.map((r) => (r._key === rk ? { ...r, name: v } : r)),
                          }));
                          setRenameRound(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setRenameRound(null);
                        }}
                      />
                    ) : (
                      <span className="editor-round__name">{round.name}</span>
                    )}
                    <label className="editor-round__meta checkbox-row">
                      <input
                        type="checkbox"
                        checked={round.is_final}
                        onChange={(e) =>
                          setDraft((p) => ({
                            rounds: p.rounds.map((r) =>
                              r._key === rk ? { ...r, is_final: e.target.checked } : r,
                            ),
                          }))
                        }
                      />
                      <span>is_final</span>
                    </label>
                    <button type="button" className="editor-btn editor-btn--ghost" onClick={() => setRenameRound(rk)}>
                      Переименовать
                    </button>
                    <button
                      type="button"
                      className="editor-btn editor-btn--danger"
                      onClick={() => setDeleteTarget({ kind: "round", rk })}
                    >
                      Удалить раунд
                    </button>
                  </div>
                  {openR ? (
                    <div className="editor-round__body">
                      <button type="button" className="editor-btn editor-btn--secondary editor-add-row" onClick={() => addTheme(rk)}>
                        + Добавить тему
                      </button>
                      <SortableContext items={themeIds} strategy={verticalListSortingStrategy}>
                        {round.themes.map((theme) => {
                          const tk = theme._key;
                          const tid = `theme:${tk}`;
                          const openT = expandedThemes.has(`${rk}|${tk}`);
                          const qIds = theme.questions.map((q) => `q:${q._key}`);
                          return (
                            <SortableThemeWrap key={tk} id={tid}>
                              <div className="editor-theme">
                                <div className="editor-theme__head">
                                  <button type="button" className="editor-round__toggle" onClick={() => toggleTheme(rk, tk)}>
                                    {openT ? "▼" : "▶"}
                                  </button>
                                  {renameTheme?.rk === rk && renameTheme.tk === tk ? (
                                    <input
                                      className="editor-inline-input"
                                      autoFocus
                                      defaultValue={theme.name}
                                      onBlur={(e) => {
                                        const v = e.target.value.trim() || "Тема";
                                        setDraft((p) => ({
                                          rounds: p.rounds.map((r) =>
                                            r._key !== rk
                                              ? r
                                              : {
                                                  ...r,
                                                  themes: r.themes.map((th) =>
                                                    th._key !== tk ? th : { ...th, name: v },
                                                  ),
                                                },
                                          ),
                                        }));
                                        setRenameTheme(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                        if (e.key === "Escape") setRenameTheme(null);
                                      }}
                                    />
                                  ) : (
                                    <span className="editor-theme__name">Тема: {theme.name}</span>
                                  )}
                                  <button
                                    type="button"
                                    className="editor-btn editor-btn--ghost"
                                    onClick={() => setRenameTheme({ rk, tk })}
                                  >
                                    Переименовать
                                  </button>
                                  <button
                                    type="button"
                                    className="editor-btn editor-btn--danger"
                                    onClick={() => setDeleteTarget({ kind: "theme", rk, tk })}
                                  >
                                    Удалить тему
                                  </button>
                                </div>
                                {openT ? (
                                  <div className="editor-theme__body">
                                    <SortableContext items={qIds} strategy={verticalListSortingStrategy}>
                                      {theme.questions.map((q) => (
                                        <SortableQuestionWrap key={q._key} id={`q:${q._key}`}>
                                          <div className="editor-q-row">
                                            <span className="editor-q-row__price">{q.price ?? "—"}</span>
                                            <span className="editor-q-row__snippet" title={q.question}>
                                              {q.question || "…"} | {q.answer || "…"}
                                            </span>
                                            <span className="editor-q-row__flags">
                                              {q.question_image ? "[картинка]" : ""}
                                              {q.question_audio ? "[аудио]" : ""}
                                            </span>
                                            <button
                                              type="button"
                                              className="editor-icon-btn"
                                              aria-label="Редактировать вопрос"
                                              onClick={() => openQuestionModal(rk, tk, q._key)}
                                            >
                                              ✎
                                            </button>
                                            <button
                                              type="button"
                                              className="editor-icon-btn"
                                              aria-label="Удалить вопрос"
                                              onClick={() => setDeleteTarget({ kind: "question", rk, tk, qk: q._key })}
                                            >
                                              🗑
                                            </button>
                                          </div>
                                        </SortableQuestionWrap>
                                      ))}
                                    </SortableContext>
                                    <ThemeDropZone id={`drop:${rk}:${tk}`} />
                                    <div className="editor-add-row">
                                      <button
                                        type="button"
                                        className="editor-btn editor-btn--secondary"
                                        onClick={() => addQuestion(rk, tk)}
                                      >
                                        + Добавить вопрос
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </SortableThemeWrap>
                          );
                        })}
                      </SortableContext>
                    </div>
                  ) : null}
                </div>
              </SortableRoundWrap>
            );
          })}
        </SortableContext>
      </DndContext>

      {deleteTarget ? (
        <div
          className="editor-backdrop"
          role="presentation"
          onClick={() => setDeleteTarget(null)}
        >
          <div className="editor-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="editor-confirm__text">
              {deleteTarget.kind === "round"
                ? "Удалить этот раунд и все темы внутри?"
                : deleteTarget.kind === "theme"
                  ? "Удалить тему и все вопросы?"
                  : "Удалить этот вопрос?"}
            </p>
            <div className="editor-confirm__actions">
              <button type="button" className="editor-btn editor-btn--secondary" onClick={() => setDeleteTarget(null)}>
                Отмена
              </button>
              <button type="button" className="editor-btn editor-btn--danger" onClick={applyDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {questionModal && qRef ? (
        <div className="editor-backdrop" role="presentation" onClick={() => setQuestionModal(null)}>
          <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Вопрос</h3>
            <div className="editor-field">
              <label htmlFor="qm-price">Цена</label>
              <input
                id="qm-price"
                type="number"
                value={qRef.price ?? ""}
                onChange={(e) =>
                  updateQuestionField("price", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </div>
            <div className="editor-field">
              <label htmlFor="qm-q">Текст вопроса</label>
              <textarea
                id="qm-q"
                value={qRef.question}
                onChange={(e) => updateQuestionField("question", e.target.value)}
              />
            </div>
            <div className="editor-field">
              <label htmlFor="qm-qi">Картинка к вопросу (URL)</label>
              <input
                id="qm-qi"
                type="text"
                value={qRef.question_image ?? ""}
                onChange={(e) =>
                  updateQuestionField("question_image", e.target.value.trim() === "" ? null : e.target.value)
                }
              />
            </div>
            <div className="editor-field">
              <label htmlFor="qm-qa">Аудио к вопросу (URL)</label>
              <input
                id="qm-qa"
                type="text"
                value={qRef.question_audio ?? ""}
                onChange={(e) =>
                  updateQuestionField("question_audio", e.target.value.trim() === "" ? null : e.target.value)
                }
              />
            </div>
            <div className="editor-field">
              <label htmlFor="qm-a">Ответ</label>
              <textarea
                id="qm-a"
                value={qRef.answer}
                onChange={(e) => updateQuestionField("answer", e.target.value)}
              />
            </div>
            <div className="editor-field">
              <label htmlFor="qm-ai">Картинка к ответу (URL)</label>
              <input
                id="qm-ai"
                type="text"
                value={qRef.answer_image ?? ""}
                onChange={(e) =>
                  updateQuestionField("answer_image", e.target.value.trim() === "" ? null : e.target.value)
                }
              />
            </div>
            <div className="editor-modal__actions">
              <button type="button" className="editor-btn editor-btn--secondary" onClick={() => setQuestionModal(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
