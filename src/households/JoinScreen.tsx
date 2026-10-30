import { useEffect, useState } from "react";
import { NewAccountForm } from "../accounts/NewAccountForm";
import type { ApiError } from "../api/client";
import {
  INVITE_NOT_FOUND_CODE,
  householdsApi,
  type Credentials,
  type Household,
  type Invite,
} from "../api/households-api";
import { Doorbell, DoorbellPlate } from "./Doorbell";
import { NameForm } from "./NameForm";

interface JoinScreenProps {
  inviteCode: string;
  onJoined: (household: Household) => void;
  onStartOwnHousehold: () => void;
  onLogIn: () => void;
}

// Either a flatmate someone already added, or a new name.
interface Identity {
  name: string;
  memberId?: string;
}

type InviteState =
  | { status: "loading" }
  | { status: "ready"; invite: Invite }
  | { status: "failed"; error: ApiError };

export function JoinScreen({ inviteCode, onJoined, onStartOwnHousehold, onLogIn }: JoinScreenProps) {
  const [inviteState, setInviteState] = useState<InviteState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [identity, setIdentity] = useState<Identity>();

  useEffect(() => {
    let isCurrent = true;
    householdsApi
      .getInvite(inviteCode)
      .then((invite) => isCurrent && setInviteState({ status: "ready", invite }))
      .catch((error: ApiError) => isCurrent && setInviteState({ status: "failed", error }));
    return () => {
      isCurrent = false;
    };
  }, [inviteCode, loadAttempt]);

  async function join(credentials: Credentials) {
    if (!identity) {
      return;
    }
    onJoined(
      identity.memberId
        ? await householdsApi.joinAsExistingMember(inviteCode, identity.memberId, credentials)
        : await householdsApi.joinAsNewMember(inviteCode, identity.name, credentials),
    );
  }

  if (inviteState.status === "loading") {
    return <p className="hint">Opening your invite…</p>;
  }

  if (inviteState.status === "failed") {
    const isBrokenLink = inviteState.error.code === INVITE_NOT_FOUND_CODE;
    return (
      <>
        <h1 className="page-title">{isBrokenLink ? "This invite link doesn't work" : "Can't open the invite"}</h1>
        <p className="intro" role="alert">
          {isBrokenLink ? "Ask a flatmate to share it again, or start your own household." : inviteState.error.message}
        </p>
        {isBrokenLink ? (
          <button className="button" type="button" onClick={onStartOwnHousehold}>
            Start a household
          </button>
        ) : (
          <button className="button" type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Try again
          </button>
        )}
      </>
    );
  }

  const { householdName, membersToJoin } = inviteState.invite;
  if (identity) {
    return (
      <>
        <button className="back-link" type="button" onClick={() => setIdentity(undefined)}>
          Not {identity.name}?
        </button>
        <h1 className="page-title">
          Join {householdName} as {identity.name}
        </h1>
        <p className="intro">Your email and password let you log in on any device.</p>
        <NewAccountForm submitLabel="Join" onSubmit={join} />
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Join {householdName}</h1>
      {membersToJoin.length === 0 && <p className="intro">Your flatmates will see you under this name.</p>}
      {membersToJoin.length > 0 && (
        <>
          <p className="intro">Which one are you?</p>
          <Doorbell label="Flatmates who have not joined yet">
            {membersToJoin.map((member) => (
              <DoorbellPlate
                key={member.id}
                hasJoined={false}
                onRing={() => setIdentity({ name: member.name, memberId: member.id })}
              >
                {member.name}
              </DoorbellPlate>
            ))}
          </Doorbell>
        </>
      )}
      <NameForm
        label={membersToJoin.length > 0 ? "Not on the list? Your name" : "Your name"}
        placeholder="How your flatmates call you"
        submitLabel="Continue"
        onSubmit={async (name) => setIdentity({ name: name.trim() })}
      />
      <p className="account-hint">
        Already have an account?{" "}
        <button className="link-button" type="button" onClick={onLogIn}>
          Log in
        </button>
      </p>
    </>
  );
}
