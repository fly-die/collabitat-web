import { useState } from "react";
import { inviteLink } from "./invite-link";

type ShareStatus = "idle" | "copied" | "manual";

export function useInviteShare(householdName: string, inviteCode: string) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const link = inviteLink(inviteCode);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${householdName} on Collabitat`, url: link });
      } catch {
        // Closing the share sheet is not an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  return { share, status, link };
}

export function InviteShareFeedback({ status, link }: { status: ShareStatus; link: string }) {
  if (status === "copied") {
    return (
      <p className="hint" role="status">
        Link copied. Paste it into your flat chat.
      </p>
    );
  }
  if (status === "manual") {
    return (
      <input
        className="text-input invite-link-field"
        readOnly
        value={link}
        aria-label="Invite link"
        onFocus={(event) => event.target.select()}
      />
    );
  }
  return null;
}
