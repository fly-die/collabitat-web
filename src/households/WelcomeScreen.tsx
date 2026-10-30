interface WelcomeScreenProps {
  onStartHousehold: () => void;
  onJoinWithLink: () => void;
  onLogIn: () => void;
}

const AREAS = ["Costs", "Chores", "Meals"];

export function WelcomeScreen({ onStartHousehold, onJoinWithLink, onLogIn }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <header className="welcome__block">
        <svg className="welcome__logo" viewBox="0 0 24 24" role="img" aria-label="Collabitat">
          <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
        </svg>
        <h1 className="welcome__title">
          Shared flat.
          <br />
          Sorted.
        </h1>
        <ol className="welcome__areas">
          {AREAS.map((area, index) => (
            <li key={area}>
              <span className="welcome__number">{String(index + 1).padStart(2, "0")}</span>
              {area}
            </li>
          ))}
        </ol>
      </header>
      <div className="welcome__body">
        <p className="intro">Who paid, whose turn it is, what's for dinner. One place for everyone who lives with you.</p>
        <div className="welcome__actions">
          <button className="button button--block" type="button" onClick={onStartHousehold}>
            Start a household
          </button>
          <button className="button button--block button--outline" type="button" onClick={onJoinWithLink}>
            Join with an invite link
          </button>
          <p className="account-hint">
            Already have an account?{" "}
            <button className="link-button" type="button" onClick={onLogIn}>
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
