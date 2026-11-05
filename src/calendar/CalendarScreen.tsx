import { useState, type FormEvent } from "react";
import { calendarApi, type CalendarColumn, type CalendarEntry, type NewCalendarEntry } from "../api/calendar-api";
import type { ApiError } from "../api/client";
import { Sheet } from "../components/Sheet";
import { UndoBar } from "../components/UndoBar";
import { useUndoable } from "../components/useUndoable";
import { todayIsoDate } from "../money/money-format";
import { columnName, describeUpcomingDay } from "./calendar-format";
import { EntryScreen } from "./EntryScreen";
import { useCalendar } from "./useCalendar";

type Editing = { entry?: CalendarEntry };

const ALL = "all";

const asNew = ({ title, day, time, columnId }: CalendarEntry): NewCalendarEntry => ({ title, day, time, columnId });

interface CalendarScreenProps {
  onBack: () => void;
}

// The next four weeks, day by day: each date says who it is for, and the list can show one person or group.
export function CalendarScreen({ onBack }: CalendarScreenProps) {
  const today = todayIsoDate();
  const { state, reload, retry } = useCalendar(today);
  const { undoable, offerUndo, takeUndo, dismissUndo } = useUndoable();
  const [editing, setEditing] = useState<Editing>();
  const [newColumnName, setNewColumnName] = useState("");
  const [error, setError] = useState<string>();
  const [shownColumn, setShownColumn] = useState(ALL);

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
  // A person's view keeps the dates for everyone, since those are theirs too.
  const activeColumn = columns.some((column) => column.id === shownColumn) ? shownColumn : ALL;
  const shownEntries =
    activeColumn === ALL ? entries : entries.filter((entry) => entry.columnId === activeColumn || entry.columnId === null);
  const days = [...new Set(shownEntries.map((entry) => entry.day))];

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

        {columns.length > 0 && (
          <div className="calendar__filters" role="group" aria-label="Show dates for">
            {[{ id: ALL, name: "All" }, ...columns].map((choice) => (
              <button
                key={choice.id}
                className={`meals__pick${activeColumn === choice.id ? " meals__pick--chosen" : ""}`}
                type="button"
                aria-pressed={activeColumn === choice.id}
                onClick={() => setShownColumn(choice.id)}
              >
                {choice.name}
              </button>
            ))}
          </div>
        )}

        {days.length === 0 ? (
          <p className="empty-state">
            {activeColumn === ALL
              ? "Nothing in the next 4 weeks. Add dates like a dentist appointment, a birthday or a parents\u2019 evening, for one person or for everyone."
              : "Nothing for them in the next 4 weeks."}
          </p>
        ) : (
          days.map((day) => (
            <section key={day} className="calendar__day" aria-labelledby={`day-${day}`}>
              <h2 id={`day-${day}`} className={`calendar__day-title${day === today ? " calendar__day-title--today" : ""}`}>
                {describeUpcomingDay(day, today)}
              </h2>
              <ul className="panel" aria-labelledby={`day-${day}`}>
                {shownEntries
                  .filter((entry) => entry.day === day)
                  .map((entry) => (
                    <li key={entry.id} className="panel__row">
                      <button className="calendar__entry" type="button" onClick={() => setEditing({ entry })}>
                        <span className="calendar__time">{entry.time ?? "All day"}</span>
                        <span className="calendar__what">
                          <span className="calendar__title">{entry.title}</span>
                          <span className="calendar__who">{columnName(columns, entry.columnId)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))
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
