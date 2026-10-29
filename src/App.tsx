import "./App.css";
import { CreateHouseholdForm } from "./households/CreateHouseholdForm";
import { HouseholdView } from "./households/HouseholdView";
import { JoinScreen } from "./households/JoinScreen";
import { useHousehold } from "./households/useHousehold";
import { InstallHint } from "./install/InstallHint";

export function App() {
  const { state, retry, showHousehold, startOwnHousehold, createHousehold, addMember, removeMember } =
    useHousehold();

  return (
    <main className="app">
      <img className="app__mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="40" height="40" />

      {state.status === "loading" && <p className="hint">Opening your household…</p>}

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
          <p className="intro">Split costs, rotate chores and plan meals with the people you live with.</p>
          <CreateHouseholdForm onSubmit={createHousehold} />
        </>
      )}

      {state.status === "joining" && (
        <JoinScreen
          inviteCode={state.inviteCode}
          onJoined={showHousehold}
          onStartOwnHousehold={startOwnHousehold}
        />
      )}

      {state.status === "ready" && (
        <>
          <HouseholdView household={state.household} onAddMember={addMember} onRemoveMember={removeMember} />
          <InstallHint />
        </>
      )}
    </main>
  );
}
