import { ApiError, INVITE_NOT_FOUND_CODE } from "../api/households-api";
import { inviteCodeFromText } from "./invite-link";
import { NameForm } from "./NameForm";

interface PasteInviteScreenProps {
  onInviteCode: (inviteCode: string) => void;
  onBack: () => void;
}

export function PasteInviteScreen({ onInviteCode, onBack }: PasteInviteScreenProps) {
  async function openInvite(text: string) {
    const inviteCode = inviteCodeFromText(text);
    if (!inviteCode) {
      throw new ApiError(INVITE_NOT_FOUND_CODE, "That doesn't look like an invite link. Copy the whole link from the message.");
    }
    onInviteCode(inviteCode);
  }

  return (
    <div className="screen">
      <button className="back-link" type="button" onClick={onBack}>
        Back
      </button>
      <h1 className="page-title">Join with an invite link</h1>
      <p className="intro">Ask a flatmate to share the invite link. Opening it on this phone is enough, or paste it here.</p>
      <NameForm label="Invite link" placeholder="Paste the link" submitLabel="Open" onSubmit={openInvite} />
    </div>
  );
}
