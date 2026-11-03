import { useState } from "react";
import "./App.css";
import { HouseholdView } from "./households/HouseholdView";
import { JoinScreen } from "./households/JoinScreen";
import { PasteInviteScreen } from "./households/PasteInviteScreen";
import { StartHouseholdScreen } from "./households/StartHouseholdScreen";
import { WelcomeScreen } from "./households/WelcomeScreen";
import { useHousehold } from "./households/useHousehold";
import { LoginScreen } from "./accounts/LoginScreen";
import { InstallHint } from "./install/InstallHint";
import { ChoresView } from "./chores/ChoresView";
import { TodayOverview } from "./home/TodayOverview";
import { useLiveConnection } from "./live/live-updates";
import { turnOffOnThisDevice } from "./notifications/useNotifications";
import { SettingsScreen } from "./settings/SettingsScreen";
import { useTheme } from "./settings/useTheme";
import { MoneySummary } from "./money/MoneySummary";
import { MoneyView } from "./money/MoneyView";
import { Tab, TabBar } from "./navigation/TabBar";

type EntryScreen = "welcome" | "start" | "paste-invite" | "log-in";

export function App() {
  const {
    state,
    retry,
    showHousehold,
    openInvite,
    startOwnHousehold,
    createHousehold,
    logIn,
    logOut,
    addAccount,
    addMember,
    removeMember,
  } = useHousehold();
  useLiveConnection(state.status === "ready");
  const theme = useTheme();
  const [entryScreen, setEntryScreen] = useState<EntryScreen>("welcome");
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Home);

  function startOwn() {
    startOwnHousehold();
    setEntryScreen("start");
  }

  function logInInstead() {
    startOwnHousehold();
    setEntryScreen("log-in");
  }

  // Settings opens over Home; any tab change leaves it.
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openTab = (tab: Tab) => {
    setIsSettingsOpen(false);
    setCurrentTab(tab);
  };

  async function logOutToWelcome() {
    // A shared or handed-on phone must not keep getting this household's notifications.
    try {
      await turnOffOnThisDevice();
    } catch {
      // Logging out goes ahead; the server forgets the device once the push service reports it gone.
    }
    setIsSettingsOpen(false);
    setEntryScreen("welcome");
    setCurrentTab(Tab.Home);
    await logOut();
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
          onLogIn={() => setEntryScreen("log-in")}
        />
      )}

      {state.status === "none" && entryScreen === "log-in" && (
        <LoginScreen onLogIn={logIn} onBack={() => setEntryScreen("welcome")} />
      )}

      {state.status === "none" && entryScreen === "start" && (
        <StartHouseholdScreen onCreate={createHousehold} onBack={() => setEntryScreen("welcome")} />
      )}

      {state.status === "none" && entryScreen === "paste-invite" && (
        <PasteInviteScreen onInviteCode={openInvite} onBack={() => setEntryScreen("welcome")} />
      )}

      {state.status === "joining" && (
        <div className="screen">
          <JoinScreen
            inviteCode={state.inviteCode}
            onJoined={showHousehold}
            onStartOwnHousehold={startOwn}
            onLogIn={logInInstead}
          />
        </div>
      )}

      {state.status === "ready" && currentTab === Tab.Home && isSettingsOpen && (
        <SettingsScreen household={state.household} theme={theme} onBack={() => setIsSettingsOpen(false)} onLogOut={logOutToWelcome} />
      )}

      {state.status === "ready" && currentTab === Tab.Home && !isSettingsOpen && (
        <HouseholdView
          household={state.household}
          onAddMember={addMember}
          onRemoveMember={removeMember}
          onAddAccount={addAccount}
          onOpenSettings={() => setIsSettingsOpen(true)}
          summary={
            <>
              <TodayOverview household={state.household} onOpenChores={() => openTab(Tab.Chores)} />
              <MoneySummary household={state.household} onOpenMoney={() => openTab(Tab.Money)} />
            </>
          }
          footer={<InstallHint />}
        />
      )}

      {state.status === "ready" && currentTab === Tab.Money && <MoneyView household={state.household} />}

      {state.status === "ready" && currentTab === Tab.Chores && <ChoresView household={state.household} />}

      {state.status === "ready" && <TabBar currentTab={currentTab} onSelect={openTab} />}
    </main>
  );
}
