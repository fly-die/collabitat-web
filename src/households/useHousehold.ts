import { useEffect, useState } from "react";
import {
  HOUSEHOLD_NOT_FOUND_CODE,
  householdsApi,
  type ApiError,
  type Household,
} from "../api/households-api";

export const HOUSEHOLD_ID_STORAGE_KEY = "collabitat.householdId";

type HouseholdState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; household: Household }
  | { status: "unreachable"; message: string };

function storedHouseholdId() {
  return localStorage.getItem(HOUSEHOLD_ID_STORAGE_KEY);
}

export function useHousehold() {
  const [state, setState] = useState<HouseholdState>(() =>
    storedHouseholdId() ? { status: "loading" } : { status: "none" },
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const householdId = storedHouseholdId();
    if (!householdId) {
      return;
    }
    let isCurrent = true;
    householdsApi
      .get(householdId)
      .then((household) => isCurrent && setState({ status: "ready", household }))
      .catch((error: ApiError) => {
        if (!isCurrent) {
          return;
        }
        if (error.code === HOUSEHOLD_NOT_FOUND_CODE) {
          localStorage.removeItem(HOUSEHOLD_ID_STORAGE_KEY);
          setState({ status: "none" });
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

  const showHousehold = (household: Household) => setState({ status: "ready", household });

  const createHousehold = async (name: string) => {
    const household = await householdsApi.create(name);
    localStorage.setItem(HOUSEHOLD_ID_STORAGE_KEY, household.id);
    showHousehold(household);
  };

  const addMember = async (householdId: string, name: string) =>
    showHousehold(await householdsApi.addMember(householdId, name));

  const removeMember = async (householdId: string, memberId: string) =>
    showHousehold(await householdsApi.removeMember(householdId, memberId));

  return { state, retry, createHousehold, addMember, removeMember };
}
