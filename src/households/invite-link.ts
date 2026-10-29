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
