import { useEffect, useState } from "react";
import { calendarApi, type CalendarView } from "../api/calendar-api";
import type { ApiError } from "../api/client";
import { useLiveTopic } from "../live/live-updates";

type CalendarState = { status: "loading" } | { status: "ready"; view: CalendarView } | { status: "unreachable"; message: string };

// Four weeks from a day, reloaded in place when a flatmate changes something.
export function useCalendar(from: string) {
  const [state, setState] = useState<CalendarState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const reload = () => setLoadAttempt((attempt) => attempt + 1);
  useLiveTopic("calendar", reload);

  useEffect(() => {
    let isCurrent = true;
    calendarApi
      .view(from)
      .then((view) => {
        if (isCurrent) {
          setState({ status: "ready", view });
        }
      })
      .catch((error: ApiError) => {
        if (isCurrent) {
          setState({ status: "unreachable", message: error.message });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [from, loadAttempt]);

  return {
    state,
    reload,
    retry: () => {
      setState({ status: "loading" });
      reload();
    },
  };
}
