import { CreateHouseholdForm } from "./CreateHouseholdForm";

interface StartHouseholdScreenProps {
  onCreate: (name: string, memberName: string) => Promise<void>;
  onBack: () => void;
}

export function StartHouseholdScreen({ onCreate, onBack }: StartHouseholdScreenProps) {
  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">Start your household</h1>
      <p className="intro">You can invite your flatmates right after.</p>
      <CreateHouseholdForm onSubmit={onCreate} />
    </div>
  );
}
