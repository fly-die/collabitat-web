import { useEffect, useRef } from "react";
import { SESSION_STORAGE_KEY } from "../api/client";
import { API_BASE_URL } from "../config";

export type LiveTopic = "money" | "chores" | "household" | "meals" | "calendar" | "notes";

const ALL_TOPICS: LiveTopic[] = ["money", "chores", "household", "meals", "calendar", "notes"];
const LIVE_PATH = "/household/live";
// The server closes with this when the session is no longer valid; retrying won't help then.
const CLOSE_UNAUTHORIZED = 4401;
// Waits between reconnect attempts, ending at the last one for as long as it takes.
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

const listenersByTopic = new Map<LiveTopic, Set<() => void>>();

function notify(topics: LiveTopic[]) {
  for (const topic of topics) {
    listenersByTopic.get(topic)?.forEach((listener) => listener());
  }
}

function liveUrl() {
  const url = new URL(LIVE_PATH, API_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

// Calls onChange whenever a flatmate changes something under this topic.
export function useLiveTopic(topic: LiveTopic, onChange: () => void) {
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });
  useEffect(() => {
    const listener = () => latestOnChange.current();
    const listeners = listenersByTopic.get(topic) ?? new Set();
    listeners.add(listener);
    listenersByTopic.set(topic, listeners);
    return () => {
      listeners.delete(listener);
    };
  }, [topic]);
}

// Keeps one connection open while signed in. Phones drop sockets in the background, so it
// reconnects on its own and when the app comes back into view, then reloads everything once
// to catch up on what it missed.
export function useLiveConnection(isSignedIn: boolean) {
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let socket: WebSocket | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failedAttempts = 0;
    let hasBeenLive = false;
    let isStopped = false;

    const connect = () => {
      const token = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!token || isStopped) {
        return;
      }
      const current = new WebSocket(liveUrl());
      socket = current;
      current.onopen = () => current.send(JSON.stringify({ token }));
      current.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as { type: string; topic?: LiveTopic };
        if (message.type === "ready") {
          failedAttempts = 0;
          if (hasBeenLive) {
            notify(ALL_TOPICS);
          }
          hasBeenLive = true;
        } else if (message.type === "changed" && message.topic) {
          notify([message.topic]);
        }
      };
      current.onclose = (event: CloseEvent) => {
        if (isStopped || socket !== current || event.code === CLOSE_UNAUTHORIZED) {
          return;
        }
        const delay = RECONNECT_DELAYS_MS[Math.min(failedAttempts, RECONNECT_DELAYS_MS.length - 1)];
        failedAttempts += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    const reconnectWhenVisible = () => {
      const isClosed = !socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED;
      if (document.visibilityState === "visible" && isClosed) {
        clearTimeout(retryTimer);
        connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", reconnectWhenVisible);
    return () => {
      isStopped = true;
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
      socket?.close();
    };
  }, [isSignedIn]);
}
