import { useState } from "react";
import "./App.css";
import { HouseholdView } from "./households/HouseholdView";
import { JoinScreen } from "./households/JoinScreen";
import { PasteInviteScreen } from "./households/PasteInviteScreen";
import { StartHouseholdScreen } from "./households/StartHouseholdScreen";
import { WelcomeScreen } from "./households/WelcomeScreen";
import { useHousehold } from "./households/useHousehold";
import { InstallHint } from "./install/InstallHint";
import { MoneyView } from "./money/MoneyView";
import { Tab, TabBar } from "./navigation/TabBar";

type EntryScreen = "welcome" | "start" | "paste-invite";

export function App() {
  const {
    state,
    retry,
    showHousehold,
    openInvite,
    startOwnHousehold,
    createHousehold,
    addMember,
    removeMember,
  } = useHousehold();
  const [entryScreen, setEntryScreen] = useState<EntryScreen>("welcome");
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Home);

  function startOwn() {
    startOwnHousehold();
    setEntryScreen("start");
  }

  return (
    <main className={`app${state.status === "ready" ? " app--with-tabs" : ""}`}>
      {state.status === "loading" && <p className="screen hint">Opening your household…</p>}

      {state.status === "unreachable" && (
        <div className="screen">
          <p role="alert">{state.message}</p>
          <button className="button" type="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.status === "none" && entryScreen === "welcome" && (
        <WelcomeScreen
          onStartHousehold={() => setEntryScreen("start")}
          onJoinWithLink={() => setEntryScreen("paste-invite")}
        />
      )}

      {state.status === "none" && entryScreen === "start" && (
        <StartHouseholdScreen onCreate={createHousehold} onBack={() => setEntryScreen("welcome")} />
      )}

      {state.status === "none" && entryScreen === "paste-invite" && (
        <PasteInviteScreen onInviteCode={openInvite} onBack={() => setEntryScreen("welcome")} />
      )}

      {state.status === "joining" && (
        <div className="screen">
          <JoinScreen inviteCode={state.inviteCode} onJoined={showHousehold} onStartOwnHousehold={startOwn} />
        </div>
      )}

      {state.status === "ready" && currentTab === Tab.Home && (
        <HouseholdView
          household={state.household}
          onAddMember={addMember}
          onRemoveMember={removeMember}
          footer={<InstallHint />}
        />
      )}

      {state.status === "ready" && currentTab === Tab.Money && <MoneyView household={state.household} />}

      {state.status === "ready" && <TabBar currentTab={currentTab} onSelect={setCurrentTab} />}
    </main>
  );
}
