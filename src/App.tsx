import "./App.css";
import { HouseholdView } from "./households/HouseholdView";
import { NameForm } from "./households/NameForm";
import { useHousehold } from "./households/useHousehold";

export function App() {
  const { state, retry, createHousehold, addMember, removeMember } = useHousehold();

  return (
    <main className="app">
      {state.status === "loading" && <p className="hint">Loading your household…</p>}

      {state.status === "unreachable" && (
        <>
          <p role="alert">{state.message}</p>
          <button className="button" type="button" onClick={retry}>
            Try again
          </button>
        </>
      )}

      {state.status === "none" && (
        <>
          <h1 className="page-title">Start your household</h1>
          <p className="intro">
            Split costs, rotate chores and plan meals with the people you live with.
          </p>
          <NameForm
            label="Household name"
            placeholder="e.g. Langstrasse 12"
            submitLabel="Create"
            onSubmit={createHousehold}
          />
        </>
      )}

      {state.status === "ready" && (
        <HouseholdView
          household={state.household}
          onAddMember={(name) => addMember(state.household.id, name)}
          onRemoveMember={(memberId) => removeMember(state.household.id, memberId)}
        />
      )}
    </main>
  );
}
