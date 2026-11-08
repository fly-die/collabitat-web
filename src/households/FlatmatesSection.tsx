import { useState } from "react";
import type { ApiError } from "../api/client";
import type { Household, Member } from "../api/households-api";
import { UndoBar } from "../components/UndoBar";
import { AddFlatmateRows } from "./AddFlatmateRows";
import { Doorbell, DoorbellPlate } from "./Doorbell";

interface FlatmatesSectionProps {
  household: Household;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

// Who lives here: add and remove flatmates, with undo. On Home while the flat is set up, in Settings after that.
export function FlatmatesSection({ household, onAddMember, onRemoveMember }: FlatmatesSectionProps) {
  const [removedMember, setRemovedMember] = useState<Member>();
  const [removeError, setRemoveError] = useState<string>();

  async function removeMember(member: Member) {
    setRemoveError(undefined);
    try {
      await onRemoveMember(member.id);
      setRemovedMember(member);
    } catch (error) {
      setRemoveError((error as ApiError).message);
    }
  }

  async function undoRemoval() {
    if (removedMember) {
      setRemovedMember(undefined);
      await onAddMember(removedMember.name);
    }
  }

  return (
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
                isMe ? (
                  <span className="you-tag">You</span>
                ) : (
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
              {!member.hasJoined && <span className="doorbell__note">Not joined yet</span>}
            </DoorbellPlate>
          );
        })}
        <AddFlatmateRows onAdd={onAddMember} />
      </Doorbell>
      {removeError && (
        <p className="form-error" role="alert">
          {removeError}
        </p>
      )}
      {removedMember && (
        <UndoBar
          key={removedMember.id}
          message={`${removedMember.name} removed.`}
          onUndo={undoRemoval}
          onExpire={() => setRemovedMember(undefined)}
        />
      )}
    </section>
  );
}
