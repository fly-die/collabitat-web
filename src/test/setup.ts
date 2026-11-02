import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { FakeWebSocket } from "./fake-web-socket";

// No test talks to a real server; live updates go through a fake socket tests can drive.
beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(cleanup);
