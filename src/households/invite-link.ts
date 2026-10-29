const INVITE_HASH_PREFIX = "#invite=";

export function inviteCodeFromLocation(): string | undefined {
  const { hash } = window.location;
  return hash.startsWith(INVITE_HASH_PREFIX) ? hash.slice(INVITE_HASH_PREFIX.length) : undefined;
}

export function clearInviteFromLocation() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

// The code sits in the hash, so it never reaches the web server's logs.
export function inviteLink(inviteCode: string) {
  return new URL(`${import.meta.env.BASE_URL}${INVITE_HASH_PREFIX}${inviteCode}`, window.location.origin).href;
}

const INVITE_CODE_IN_TEXT_PATTERN = /(?:^|#invite=)([0-9a-f]{32})$/;

// Accepts a pasted invite link or just its code.
export function inviteCodeFromText(text: string): string | undefined {
  return INVITE_CODE_IN_TEXT_PATTERN.exec(text.trim())?.[1];
}
