import { useState } from "react";
import { inviteLink } from "./invite-link";

type ShareStatus = "idle" | "copied" | "manual";

export function InviteShare({ householdName, inviteCode }: { householdName: string; inviteCode: string }) {
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

  return (
    <section className="invite" aria-labelledby="invite-heading">
      <h2 id="invite-heading" className="section-title">
        Invite flatmates
      </h2>
      <p className="hint">Anyone with the link can join {householdName}.</p>
      <button className="button button--secondary" type="button" onClick={share}>
        Share invite link
      </button>
      {status === "copied" && (
        <p className="hint invite__status" role="status">
          Link copied. Paste it into your flat chat.
        </p>
      )}
      {status === "manual" && (
        <input
          className="text-input invite__link"
          readOnly
          value={link}
          aria-label="Invite link"
          onFocus={(event) => event.target.select()}
        />
      )}
    </section>
  );
}
