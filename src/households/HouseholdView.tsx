import { useEffect, useState } from "react";
import type { Household, Member } from "../api/households-api";
import { NameForm } from "./NameForm";

export const UNDO_TIMEOUT_MS = 6000;

interface HouseholdViewProps {
  household: Household;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export function HouseholdView({ household, onAddMember, onRemoveMember }: HouseholdViewProps) {
  const [removedMember, setRemovedMember] = useState<Member>();

  useEffect(() => {
    if (!removedMember) {
      return;
    }
    const timeout = setTimeout(() => setRemovedMember(undefined), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [removedMember]);

  async function removeMember(member: Member) {
    await onRemoveMember(member.id);
    setRemovedMember(member);
  }

  async function undoRemoval() {
    if (removedMember) {
      setRemovedMember(undefined);
      await onAddMember(removedMember.name);
    }
  }

  return (
    <>
      <h1 className="page-title">{household.name}</h1>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="section-title">
          Flatmates
        </h2>
        {household.members.length === 0 ? (
          <p className="hint">No one here yet. Add the people you live with.</p>
        ) : (
          <ul className="member-list">
            {household.members.map((member) => (
              <li key={member.id} className="member-list__item">
                <span>{member.name}</span>
                <button
                  className="button button--quiet"
                  type="button"
                  aria-label={`Remove ${member.name}`}
                  onClick={() => removeMember(member)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <NameForm
          label="Add a flatmate"
          placeholder="Name"
          submitLabel="Add"
          onSubmit={onAddMember}
        />
      </section>

      {removedMember && (
        <div className="undo-bar" role="status">
          <span>{removedMember.name} removed.</span>
          <button className="button button--on-dark" type="button" onClick={undoRemoval}>
            Undo
          </button>
        </div>
      )}
    </>
  );
}
