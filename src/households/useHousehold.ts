import { useEffect, useState } from "react";
import {
  UNAUTHORIZED_CODE,
  endSession,
  hasSession,
  householdsApi,
  type ApiError,
  type Household,
} from "../api/households-api";
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

  const startOwnHousehold = () => {
    clearInviteFromLocation();
    setState({ status: "none" });
  };

  const createHousehold = async (name: string, memberName: string) =>
    showHousehold(await householdsApi.create(name, memberName));

  const addMember = async (name: string) => showHousehold(await householdsApi.addMember(name));

  const removeMember = async (memberId: string) =>
    showHousehold(await householdsApi.removeMember(memberId));

  return { state, retry, showHousehold, startOwnHousehold, createHousehold, addMember, removeMember };
}
