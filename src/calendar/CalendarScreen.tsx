import { useState, type FormEvent } from "react";
import { calendarApi, type CalendarColumn, type CalendarEntry, type NewCalendarEntry } from "../api/calendar-api";
import type { ApiError } from "../api/client";
import { Sheet } from "../components/Sheet";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { todayIsoDate } from "../money/money-format";
import { EVERYONE, describeUpcomingDay } from "./calendar-format";
import { EntryScreen } from "./EntryScreen";
import { useCalendar } from "./useCalendar";

type Editing = { entry?: CalendarEntry };

const asNew = ({ title, day, time, columnId }: CalendarEntry): NewCalendarEntry => ({ title, day, time, columnId });

interface CalendarScreenProps {
  onBack: () => void;
}

// The next four weeks: a row for each day with dates, a column for everyone and for each person or group.
export function CalendarScreen({ onBack }: CalendarScreenProps) {
  const today = todayIsoDate();
  const { state, reload, retry } = useCalendar(today);
  const { undoable, offerUndo, takeUndo } = useUndoable();
  const [editing, setEditing] = useState<Editing>();
  const [newColumnName, setNewColumnName] = useState("");
  const [error, setError] = useState<string>();

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

  if (state.status === "loading") {
    return <p className="screen hint">Looking at the next weeks…</p>;
  }
  if (state.status === "unreachable") {
    return (
      <div className="screen">
        <button className="back-link" type="button" onClick={onBack}>
          Back
        </button>
        <p className="form-error" role="alert">
          {state.message}
        </p>
        <button className="button" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const { columns, entries } = state.view;
  const lanes: { id: string | null; name: string }[] = [{ id: null, name: EVERYONE }, ...columns];
  const days = [...new Set(entries.map((entry) => entry.day))];

  async function saveEntry(entry: NewCalendarEntry) {
    const existing = editing?.entry;
    await (existing ? calendarApi.updateEntry(existing.id, entry) : calendarApi.addEntry(entry));
    reload();
  }

  async function removeEntry(entry: CalendarEntry) {
    setEditing(undefined);
    if (await run(() => calendarApi.removeEntry(entry.id))) {
      offerUndo({ message: `${entry.title} removed.`, undo: () => calendarApi.addEntry(asNew(entry)) });
    }
  }

  async function addColumn(event: FormEvent) {
    event.preventDefault();
    if (!newColumnName.trim()) {
      setError("Type a name, like Noah or Family.");
      return;
    }
    if (await run(() => calendarApi.addColumn(newColumnName))) {
      setNewColumnName("");
    }
  }

  async function removeColumn(column: CalendarColumn) {
    if (await run(() => calendarApi.removeColumn(column.id))) {
      offerUndo({ message: `${column.name} removed.`, undo: () => calendarApi.addColumn(column.name) });
    }
  }

  const isBehindSheet = editing !== undefined;

  return (
    <>
      <div className="screen calendar" inert={isBehindSheet} aria-hidden={isBehindSheet || undefined}>
        <button className="back-link" type="button" onClick={onBack}>
          Back
        </button>
        <h1 className="page-title">Calendar</h1>
        <button className="button button--block" type="button" onClick={() => setEditing({})}>
          Add a date
        </button>

        {days.length === 0 ? (
          <p className="empty-state">
            Nothing in the next 4 weeks. Add dates like a dentist appointment, a birthday or a parents&apos; evening, for one
            person or for everyone.
          </p>
        ) : (
          <div className="calendar__scroll">
            <table className="calendar__grid">
              <caption className="visually-hidden">Dates in the next 4 weeks</caption>
              <thead>
                <tr>
                  <td />
                  {lanes.map((lane) => (
                    <th key={lane.id ?? EVERYONE} scope="col">
                      {lane.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day} className={day === today ? "calendar__today" : undefined}>
                    <th scope="row">{describeUpcomingDay(day, today)}</th>
                    {lanes.map((lane) => (
                      <td key={lane.id ?? EVERYONE}>
                        {entries
                          .filter((entry) => entry.day === day && entry.columnId === lane.id)
                          .map((entry) => (
                            <button key={entry.id} className="calendar__entry" type="button" onClick={() => setEditing({ entry })}>
                              {entry.time && <span className="calendar__time">{entry.time}</span>}
                              <span>{entry.title}</span>
                            </button>
                          ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="calendar__columns" aria-labelledby="columns-heading">
          <h2 id="columns-heading" className="section-title">
            People and groups
          </h2>
          <p className="field-hint">Give each person or group a column, like a child without an account or the whole family.</p>
          {columns.length > 0 && (
            <ul className="panel" aria-labelledby="columns-heading">
              {columns.map((column) => (
                <li key={column.id} className="panel__row expense">
                  <span className="expense__text">
                    <span className="expense__description">{column.name}</span>
                  </span>
                  <button
                    className="button button--quiet expense__delete"
                    type="button"
                    aria-label={`Remove ${column.name}`}
                    onClick={() => void removeColumn(column)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="shopping__add" onSubmit={(event) => void addColumn(event)}>
            <input
              className="text-input"
              aria-label="Add a column"
              placeholder="Noah"
              autoComplete="off"
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
            />
            <button className="button" type="submit">
              Add
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>

        {undoable && (
          <UndoBar
            message={undoable.message}
            onUndo={() => {
              const undo = takeUndo();
              if (undo) {
                void run(undo);
              }
            }}
          />
        )}
      </div>
      {editing && (
        <Sheet label={editing.entry ? "Edit date" : "Add a date"} onClose={() => setEditing(undefined)}>
          <EntryScreen
            columns={columns}
            today={today}
            entry={editing.entry}
            onSave={saveEntry}
            onRemove={editing.entry ? () => void removeEntry(editing.entry as CalendarEntry) : undefined}
            onBack={() => setEditing(undefined)}
          />
        </Sheet>
      )}
    </>
  );
}
