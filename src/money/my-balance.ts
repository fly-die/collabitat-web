import type { Transfer } from "../api/expenses-api";

export interface MyBalance {
  isOwing: boolean;
  // The words before the amount, e.g. "You owe Lea ", or the whole sentence when I'm square.
  prefix: string;
  // What I owe or get back in total, after simplifying; undefined when I'm square.
  cents?: number;
}

// After simplifying, nobody both owes and is owed, so my transfers all point the same way.
export function myBalance(transfers: Transfer[], me: string, nameOf: (memberId: string) => string): MyBalance {
  const owing = transfers.filter((transfer) => transfer.fromMemberId === me);
  const owed = transfers.filter((transfer) => transfer.toMemberId === me);
  const cents = [...owing, ...owed].reduce((sum, transfer) => sum + transfer.amountCents, 0);

  if (owing.length > 0) {
    const prefix = owing.length === 1 ? `You owe ${nameOf(owing[0].toMemberId)} ` : "You owe ";
    return { isOwing: true, prefix, cents };
  }
  if (owed.length > 0) {
    const prefix = owed.length === 1 ? `${nameOf(owed[0].fromMemberId)} owes you ` : "You get back ";
    return { isOwing: false, prefix, cents };
  }
  return { isOwing: false, prefix: "You're all square" };
}
