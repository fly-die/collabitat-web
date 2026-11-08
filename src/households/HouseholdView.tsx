import { useState, type ReactNode } from "react";
import { NewAccountForm } from "../accounts/NewAccountForm";
import type { Credentials, Household } from "../api/households-api";
import { FlatmatesSection } from "./FlatmatesSection";
import { InviteShareFeedback, useInviteShare } from "./InviteShare";

// From two people on, the flat is set up: who lives here moves to Settings.
const SET_UP_FROM_MEMBERS = 2;


interface HouseholdViewProps {
  household: Household;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onAddAccount: (credentials: Credentials) => Promise<void>;
  onOpenSettings: () => void;
  // Shown right under the household name, e.g. where I stand with money.
  summary?: ReactNode;
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

// Home opens on today, so the date sits where "Your household" used to.
const TODAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function HouseholdView({
  household,
  onAddMember,
  onRemoveMember,
  onAddAccount,
  onOpenSettings,
  summary,
  footer,
}: HouseholdViewProps) {
  const invite = useInviteShare(household.name, household.inviteCode);
  const openStep = nextStepTitle(household);
  // Decided when Home opens, so the list doesn't vanish while someone is still adding flatmates.
  const [isSettingUp] = useState(() => household.members.length < SET_UP_FROM_MEMBERS);

  return (
    <div className="screen household">
      <div className="household__main">
        <div className="household__top">
          <p className="eyebrow">{TODAY_FORMAT.format(new Date())}</p>
          <button className="button button--outline settings-button" type="button" onClick={onOpenSettings}>
            <svg className="settings-button__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2" />
              <circle cx="9" cy="17" r="2" />
            </svg>
            Settings
          </button>
        </div>
        <h1 className="page-title page-title--large">{household.name}</h1>
        {summary}

        {isSettingUp && <FlatmatesSection household={household} onAddMember={onAddMember} onRemoveMember={onRemoveMember} />}
      </div>

      <div className="household__aside">
        {!household.currentMemberHasAccount && (
          <section className="account-card" aria-labelledby="account-card-heading">
            <h2 id="account-card-heading" className="section-title">
              Add your email to log in anywhere
            </h2>
            <p className="hint">Only this browser knows you right now.</p>
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
          isSettingUp && (
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
          )
        )}
        {footer}
      </div>

    </div>
  );
}
