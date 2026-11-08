import { useEffect, useState, type FormEvent } from "react";
import type { ApiError } from "../api/client";
import type { Household } from "../api/households-api";
import { notesApi, type Note } from "../api/notes-api";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { useLiveTopic } from "../live/live-updates";

interface HouseholdNotesProps {
  household: Household;
}

function authorOf(household: Household, note: Note) {
  if (note.authorMemberId === household.currentMemberId) {
    return "You";
  }
  return household.members.find((member) => member.id === note.authorMemberId)?.name ?? "A former flatmate";
}

// On Home: quick notes anyone can add and tick off. Quiet until loaded.
export function HouseholdNotes({ household }: HouseholdNotesProps) {
  const [notes, setNotes] = useState<Note[]>();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { undoable, offerUndo, takeUndo, dismissUndo } = useUndoable();
  const reload = () => setLoadAttempt((attempt) => attempt + 1);
  useLiveTopic("notes", reload);

  useEffect(() => {
    let isCurrent = true;
    notesApi
      .list()
      .then(({ notes: loaded }) => {
        if (isCurrent) {
          setNotes(loaded);
        }
      })
      .catch((loadError: ApiError) => {
        if (isCurrent) {
          setError(loadError.message);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  async function run(action: () => Promise<unknown>) {
    setError(undefined);
    try {
      await action();
      reload();
      return true;
    } catch (actionError) {
      setError((actionError as ApiError).message);
      return false;
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Type a note first, like Bins out on Monday.");
      return;
    }
    if (await run(() => notesApi.add(text))) {
      setText("");
    }
  }

  async function remove(note: Note) {
    if (await run(() => notesApi.remove(note.id))) {
      offerUndo({ message: "Note removed.", undo: () => notesApi.add(note.text, Boolean(note.doneAt)) });
    }
  }

  async function clearDone() {
    let removed: Note[] = [];
    const isCleared = await run(async () => {
      removed = (await notesApi.clearDone()).removed;
    });
    if (isCleared) {
      offerUndo({
        message: removed.length === 1 ? "1 done note cleared." : `${removed.length} done notes cleared.`,
        undo: () => Promise.all(removed.map((note) => notesApi.add(note.text, true))),
      });
    }
  }

  if (!notes) {
    return error ? (
      <p className="form-error" role="alert">
        {error}
      </p>
    ) : null;
  }
  const doneCount = notes.filter((note) => note.doneAt).length;

  return (
    <section className="today notes" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="section-title">
        Notes
      </h2>
      <form className="shopping__add" onSubmit={(event) => void handleAdd(event)}>
        <input
          className="text-input"
          aria-label="Add a note"
          placeholder="Bins out on Monday"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="button" type="submit">
          Add note
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notes.length === 0 ? (
        <p className="today__note">No notes yet.</p>
      ) : (
        <ul className="panel" aria-labelledby="notes-heading">
          {notes.map((note) => (
            <li key={note.id} className={`panel__row expense${note.doneAt ? " shopping__item--checked" : ""}`}>
              <label className="shopping__tick">
                <input
                  type="checkbox"
                  aria-label={note.text}
                  checked={Boolean(note.doneAt)}
                  onChange={() => void run(() => notesApi.setDone(note.id, !note.doneAt))}
                />
                <span className="expense__text">
                  <span className="expense__description">{note.text}</span>
                  <span className="expense__meta">
                    <span>{authorOf(household, note)}</span>
                  </span>
                </span>
              </label>
              <button
                className="button button--quiet expense__delete"
                type="button"
                aria-label={`Remove note: ${note.text}`}
                onClick={() => void remove(note)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {doneCount > 0 && (
        <button className="button button--quiet notes__clear" type="button" onClick={() => void clearDone()}>
          Clear done notes
        </button>
      )}
      {undoable && (
        <UndoBar
            key={undoable.id}
            onExpire={dismissUndo}
          message={undoable.message}
          onUndo={() => {
            const undo = takeUndo();
            if (undo) {
              void run(undo);
            }
          }}
        />
      )}
    </section>
  );
}
