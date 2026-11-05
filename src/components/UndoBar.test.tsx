import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_TIMEOUT_MS, UndoBar } from "./UndoBar";

const ALMOST_GONE_MS = UNDO_TIMEOUT_MS - 500;

describe("undo bar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("goes after its countdown, unless touched while fading, which starts it again", () => {
    const onExpire = vi.fn();
    render(<UndoBar message="Note removed." onUndo={vi.fn()} onExpire={onExpire} />);

    act(() => vi.advanceTimersByTime(ALMOST_GONE_MS));
    fireEvent.pointerDown(screen.getByRole("status"));
    act(() => vi.advanceTimersByTime(ALMOST_GONE_MS));
    expect(onExpire).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(UNDO_TIMEOUT_MS - ALMOST_GONE_MS));
    expect(onExpire).toHaveBeenCalledOnce();
  });
});
