import { useEffect, useState } from "react";
import { UNAUTHORIZED_CODE, endSession, hasSession, type ApiError } from "../api/client";
import { householdsApi, type Credentials, type Household } from "../api/households-api";
import { clearInviteFromLocation, inviteCodeFromLocation } from "./invite-link";

const LEGACY_HOUSEHOLD_ID_KEY = "collabitat.householdId";

type HouseholdState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "joining"; inviteCode: string }
  | { status: "ready"; household: Household }
  | { status: "unreachable"; message: string };

function stateWithoutHousehold(): HouseholdState {
  const inviteCode = inviteCodeFromLocation();
  return inviteCode ? { status: "joining", inviteCode } : { status: "none" };
}

export function useHousehold() {
  const [state, setState] = useState<HouseholdState>(() =>
    hasSession() ? { status: "loading" } : stateWithoutHousehold(),
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    localStorage.removeItem(LEGACY_HOUSEHOLD_ID_KEY);
    if (!hasSession()) {
      return;
    }
    let isCurrent = true;
    householdsApi
      .get()
      .then((household) => {
        if (!isCurrent) {
          return;
        }
        const inviteCode = inviteCodeFromLocation();
        if (inviteCode && inviteCode !== household.inviteCode) {
          setState({ status: "joining", inviteCode });
          return;
        }
        clearInviteFromLocation();
        setState({ status: "ready", household });
      })
      .catch((error: ApiError) => {
        if (!isCurrent) {
          return;
        }
        if (error.code === UNAUTHORIZED_CODE) {
          endSession();
          setState(stateWithoutHousehold());
        } else {
          setState({ status: "unreachable", message: error.message });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [loadAttempt]);

  const retry = () => {
    setState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  };

  const showHousehold = (household: Household) => {
    clearInviteFromLocation();
    setState({ status: "ready", household });
  };

  const openInvite = (inviteCode: string) => setState({ status: "joining", inviteCode });

  const startOwnHousehold = () => {
    clearInviteFromLocation();
    setState({ status: "none" });
  };

  const createHousehold = async (name: string, memberName: string, credentials: Credentials) =>
    showHousehold(await householdsApi.create(name, memberName, credentials));

  const logIn = async (credentials: Credentials) => showHousehold(await householdsApi.logIn(credentials));

  const logOut = async () => {
    try {
      await householdsApi.logOut();
    } finally {
      setState({ status: "none" });
    }
  };

  const addAccount = async (credentials: Credentials) =>
    showHousehold(await householdsApi.addAccount(credentials));

  const addMember = async (name: string) => showHousehold(await householdsApi.addMember(name));

  const removeMember = async (memberId: string) =>
    showHousehold(await householdsApi.removeMember(memberId));

  return {
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
  };
}
