import type { Credentials } from "../api/households-api";
import { CreateHouseholdForm } from "./CreateHouseholdForm";

interface StartHouseholdScreenProps {
  onCreate: (name: string, memberName: string, credentials: Credentials) => Promise<void>;
  onBack: () => void;
}

export function StartHouseholdScreen({ onCreate, onBack }: StartHouseholdScreenProps) {
  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">Start your household</h1>
      <p className="intro">You can invite your flatmates right after. Your email and password let you log in on any device.</p>
      <CreateHouseholdForm onSubmit={onCreate} />
    </div>
  );
}
