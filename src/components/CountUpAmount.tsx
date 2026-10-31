import { useEffect, useState } from "react";
import { formatAmount } from "../money/money-format";

const COUNT_DURATION_MS = 600;

function prefersMotion() {
  return typeof window.matchMedia === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

interface Animation {
  from: number;
  to: number;
}

// Counts from the old amount to the new one, so a change in balance is easy to notice.
interface CountUpAmountProps {
  cents: number;
  // What was on screen before, when the amount comes back after another screen.
  startFromCents?: number;
}

export function CountUpAmount({ cents, startFromCents }: CountUpAmountProps) {
  const [previousCents, setPreviousCents] = useState(startFromCents ?? cents);
  const [animation, setAnimation] = useState<Animation>();
  const [frameCents, setFrameCents] = useState<number>();

  if (cents !== previousCents) {
    setPreviousCents(cents);
    setAnimation(prefersMotion() ? { from: frameCents ?? previousCents, to: cents } : undefined);
  }

  useEffect(() => {
    if (!animation) {
      return;
    }
    let frameId = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / COUNT_DURATION_MS, 1);
      if (progress === 1) {
        setAnimation(undefined);
        setFrameCents(undefined);
        return;
      }
      setFrameCents(Math.round(animation.from + (animation.to - animation.from) * easeOutCubic(progress)));
      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [animation]);

  return <span className="count-up">{formatAmount(animation ? (frameCents ?? animation.from) : cents)}</span>;
}
