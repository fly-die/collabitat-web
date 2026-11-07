const FEWEST = 1;
const MOST = 50;

interface ServingsStepperProps {
  // Names the control for screen readers, like "How many eat?".
  label: string;
  servings: number;
  onChange: (servings: number) => void;
}

// How many people: tap fewer or more, no keyboard needed.
export function ServingsStepper({ label, servings, onChange }: ServingsStepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        className="stepper__button"
        type="button"
        aria-label="Fewer people"
        disabled={servings <= FEWEST}
        onClick={() => onChange(servings - 1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </button>
      <span className="stepper__value" aria-live="polite">
        {servings} {servings === 1 ? "person" : "people"}
      </span>
      <button
        className="stepper__button"
        type="button"
        aria-label="More people"
        disabled={servings >= MOST}
        onClick={() => onChange(servings + 1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </button>
    </div>
  );
}
