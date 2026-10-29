import { useEffect, useState } from "react";
import {
  INVITE_NOT_FOUND_CODE,
  householdsApi,
  type ApiError,
  type Household,
  type Invite,
} from "../api/households-api";
import { Doorbell, DoorbellPlate } from "./Doorbell";
import { NameForm } from "./NameForm";

interface JoinScreenProps {
  inviteCode: string;
  onJoined: (household: Household) => void;
  onStartOwnHousehold: () => void;
}

type InviteState =
  | { status: "loading" }
  | { status: "ready"; invite: Invite }
  | { status: "failed"; error: ApiError };

export function JoinScreen({ inviteCode, onJoined, onStartOwnHousehold }: JoinScreenProps) {
  const [inviteState, setInviteState] = useState<InviteState>({ status: "loading" });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [joinError, setJoinError] = useState<string>();

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

  async function joinAs(memberId: string) {
    setJoinError(undefined);
    try {
      onJoined(await householdsApi.joinAsExistingMember(inviteCode, memberId));
    } catch (error) {
      setJoinError((error as ApiError).message);
    }
  }

  async function joinAsNewMember(name: string) {
    onJoined(await householdsApi.joinAsNewMember(inviteCode, name));
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
  return (
    <>
      <h1 className="page-title">Join {householdName}</h1>
      {membersToJoin.length === 0 && <p className="intro">Your flatmates will see you under this name.</p>}
      {membersToJoin.length > 0 && (
        <>
          <p className="intro">Which one are you?</p>
          <Doorbell label="Flatmates who have not joined yet">
            {membersToJoin.map((member) => (
              <DoorbellPlate key={member.id} hasJoined={false} onRing={() => joinAs(member.id)}>
                {member.name}
              </DoorbellPlate>
            ))}
          </Doorbell>
          {joinError && (
            <p className="form-error" role="alert">
              {joinError}
            </p>
          )}
        </>
      )}
      <NameForm
        label={membersToJoin.length > 0 ? "Not on the list? Your name" : "Your name"}
        placeholder="How your flatmates call you"
        submitLabel="Join"
        onSubmit={joinAsNewMember}
      />
    </>
  );
}
