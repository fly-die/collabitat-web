import { useEffect, useState, type ReactNode } from "react";
import { NewAccountForm } from "../accounts/NewAccountForm";
import { UNDO_TIMEOUT_MS, UndoBar } from "../components/UndoBar";
import type { ApiError } from "../api/client";
import type { Credentials, Household, Member } from "../api/households-api";
import { Doorbell, DoorbellPlate } from "./Doorbell";
import { InviteShareFeedback, useInviteShare } from "./InviteShare";
import { AddFlatmateRows } from "./AddFlatmateRows";


interface HouseholdViewProps {
  household: Household;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onAddAccount: (credentials: Credentials) => Promise<void>;
  onLogOut: () => void;
  footer?: ReactNode;
}

function nextStepTitle(household: Household) {
  const waiting = household.members.filter((member) => !member.hasJoined);
  if (waiting.length === 0) {
    return household.members.length === 1 ? "Invite your flatmates" : undefined;
  }
  return waiting.length === 1
    ? `Get ${waiting[0].name} to join`
    : `Get ${waiting.length} flatmates to join`;
}

export function HouseholdView({
  household,
  onAddMember,
  onRemoveMember,
  onAddAccount,
  onLogOut,
  footer,
}: HouseholdViewProps) {
  const [removedMember, setRemovedMember] = useState<Member>();
  const [removeError, setRemoveError] = useState<string>();
  const invite = useInviteShare(household.name, household.inviteCode);
  const openStep = nextStepTitle(household);

  useEffect(() => {
    if (!removedMember) {
      return;
    }
    const timeout = setTimeout(
      () => setRemovedMember(undefined),
      UNDO_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, [removedMember]);

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
    <div className="screen household">
      <div className="household__main">
        <p className="eyebrow">Your household</p>
        <h1 className="page-title page-title--large">{household.name}</h1>

        <section aria-labelledby="members-heading">
          <h2 id="members-heading" className="visually-hidden">
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
                  {!member.hasJoined && (
                    <span className="doorbell__note">Not joined yet</span>
                  )}
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
        </section>
      </div>

      <div className="household__aside">
        {!household.currentMemberHasAccount && (
          <section className="account-card" aria-labelledby="account-card-heading">
            <h2 id="account-card-heading" className="section-title">
              Add your email to log in anywhere
            </h2>
            <p className="hint">Right now only this browser knows you. With an account you can open your household on any device.</p>
            <NewAccountForm submitLabel="Save account" onSubmit={onAddAccount} />
          </section>
        )}
        {openStep ? (
          <section
            className="getting-started"
            aria-labelledby="getting-started-heading"
          >
            <h2 id="getting-started-heading" className="section-title">
              Getting started
            </h2>
            <ol className="steps">
              <li className="steps__done">
                <svg
                  className="steps__check"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="m5 12 5 5 9-10" />
                </svg>
                Household set up
              </li>
              <li className="steps__open">
                <span className="steps__title">
                  <span className="steps__ring" aria-hidden="true" />
                  {openStep}
                </span>
                <button
                  className="button button--block"
                  type="button"
                  onClick={invite.share}
                >
                  Share invite link
                </button>
                <InviteShareFeedback
                  status={invite.status}
                  link={invite.link}
                />
              </li>
            </ol>
          </section>
        ) : (
          <div className="later-invite">
            <button
              className="button button--outline"
              type="button"
              onClick={invite.share}
            >
              Share invite link
            </button>
            <InviteShareFeedback status={invite.status} link={invite.link} />
          </div>
        )}
        {footer}
        {household.currentMemberHasAccount && (
          <button className="link-button log-out" type="button" onClick={onLogOut}>
            Log out
          </button>
        )}
      </div>

      {removedMember && (
        <UndoBar message={`${removedMember.name} removed.`} onUndo={undoRemoval} />
      )}
    </div>
  );
}
