import { useEffect, useState } from "react";
import type { Household, Member } from "../api/households-api";
import { Doorbell, DoorbellPlate } from "./Doorbell";
import { InviteShare } from "./InviteShare";
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
        <Doorbell label="Flatmates">
          {household.members.map((member) => {
            const isMe = member.id === household.currentMemberId;
            return (
              <DoorbellPlate
                key={member.id}
                hasJoined={member.hasJoined}
                action={
                  !isMe && (
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label={`Remove ${member.name}`}
                      onClick={() => removeMember(member)}
                    >
                      Remove
                    </button>
                  )
                }
              >
                {member.name}
                {isMe && <span className="doorbell__note"> (you)</span>}
                {!member.hasJoined && <span className="doorbell__note">Not joined yet</span>}
              </DoorbellPlate>
            );
          })}
        </Doorbell>
        {household.members.length === 1 && (
          <p className="hint">Add the people you live with, or send them the invite link below.</p>
        )}
        <NameForm label="Add a flatmate" placeholder="Name" submitLabel="Add" onSubmit={onAddMember} />
      </section>

      <InviteShare householdName={household.name} inviteCode={household.inviteCode} />

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
