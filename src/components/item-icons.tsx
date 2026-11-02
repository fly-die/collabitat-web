import type { ReactNode } from "react";

export type IconName =
  | "trash"
  | "bath"
  | "broom"
  | "plant"
  | "kitchen"
  | "laundry"
  | "cart"
  | "food"
  | "drink"
  | "home"
  | "bolt"
  | "wifi"
  | "chore"
  | "receipt"
  | "payment";

// German and English word starts, lower case. The longest match wins, so "toilet paper" is
// shopping rather than the bathroom, and "Badezimmer putzen" is the bathroom rather than cleaning.
const KEYWORDS: Record<Exclude<IconName, "chore" | "receipt" | "payment">, string[]> = {
  trash: ["trash", "garbage", "rubbish", "bin", "recycl", "müll", "muell", "abfall", "kehricht", "entsorg", "altglas", "altpapier", "karton", "compost", "kompost"],
  bath: ["bathroom", "badezimmer", "bath", "shower", "toilet", "wc", "loo", "sink", "bad", "dusche", "klo", "toilette", "lavabo"],
  broom: ["clean", "hoover", "vacuum", "sweep", "mop", "dust", "floor", "hallway", "putz", "saug", "staubsaug", "wisch", "boden", "fegen", "reinig", "flur", "gang"],
  plant: ["plant", "water the", "garden", "flower", "pflanz", "giess", "gieß", "garten", "blume", "balkon"],
  kitchen: ["kitchen", "dish", "fridge", "oven", "kettle", "descal", "küche", "kueche", "geschirr", "kühlschrank", "ofen", "wasserkocher", "entkalk", "abwasch", "spül"],
  laundry: ["laundry", "washing", "towel", "bed sheet", "wäsche", "waesche", "waschen", "handt", "bettwäsche"],
  cart: ["grocer", "migros", "coop", "aldi", "lidl", "denner", "supermarket", "shopping", "einkauf", "lebensmittel", "toilet paper", "toilettenpapier", "wc-papier", "soap", "detergent", "seife", "putzmittel", "haushaltsartikel"],
  food: ["pizza", "dinner", "lunch", "breakfast", "restaurant", "takeaway", "take-away", "food", "kebab", "sushi", "burger", "essen", "znacht", "zmittag", "zmorge", "abendessen", "mittagessen"],
  drink: ["beer", "wine", "drink", "coffee", "party", "bier", "wein", "kaffee", "getränk", "apéro", "apero"],
  home: ["rent", "miete", "nebenkosten", "furniture", "möbel", "ikea", "repair", "reparatur"],
  bolt: ["electric", "power", "energy", "strom", "ewz", "heating", "heizung"],
  wifi: ["internet", "wifi", "wi-fi", "wlan", "swisscom", "sunrise", "netflix", "spotify", "subscription", "abo", "serafe"],
};

const KEYWORDS_LONGEST_FIRST = Object.entries(KEYWORDS)
  .flatMap(([icon, words]) => words.map((word) => ({ icon: icon as IconName, word })))
  .sort((first, second) => second.word.length - first.word.length);

// Matches only at the start of a word, so "rent" doesn't light up in "parent" or "current".
function startsAWord(title: string, word: string) {
  let index = title.indexOf(word);
  while (index !== -1) {
    if (index === 0 || !/\p{L}/u.test(title[index - 1])) {
      return true;
    }
    index = title.indexOf(word, index + 1);
  }
  return false;
}

export function iconFor(title: string, fallback: IconName): IconName {
  const lowerTitle = title.toLocaleLowerCase("de-CH");
  return KEYWORDS_LONGEST_FIRST.find(({ word }) => startsAWord(lowerTitle, word))?.icon ?? fallback;
}

// Line icons on a 24px grid, drawn in the same stroke style as the tab bar.
const PATHS: Record<IconName, ReactNode> = {
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  bath: (
    <>
      <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M6 12V6.5a2.5 2.5 0 0 1 4.6-1.4M7.5 19 6.5 21M16.5 19l1 2" />
    </>
  ),
  broom: (
    <>
      <path d="M15.5 3 12 11" />
      <path d="M8 11h8l1.5 10h-11z" />
      <path d="M10.5 15v6M13.5 15v6" />
    </>
  ),
  plant: (
    <>
      <path d="M7 14h10l-1.5 7h-7z" />
      <path d="M12 14V9.5" />
      <path d="M12 10c0-3 2-5 5-5 0 3-2 5-5 5zM12 11c0-2.5-1.8-4-4.5-4 0 2.5 1.8 4 4.5 4z" />
    </>
  ),
  kitchen: (
    <>
      <path d="M5 10h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" />
      <path d="M3 10h18M10 6.5h4" />
    </>
  ),
  laundry: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="13" r="4" />
      <path d="M8 6.5h2" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.5h10.6L20 7.5H6.3" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  food: (
    <>
      <path d="M7 3v6a2 2 0 0 0 4 0V3M9 3v18" />
      <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </>
  ),
  drink: (
    <>
      <path d="M6 4h12l-1.5 7a4.6 4.6 0 0 1-9 0z" />
      <path d="M12 15.5V20M8.5 20h7" />
    </>
  ),
  home: (
    <>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </>
  ),
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  wifi: (
    <>
      <path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0" />
      <circle cx="12" cy="19.5" r="0.75" />
    </>
  ),
  chore: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  payment: <path d="M5 9h13l-3-3M19 15H6l3 3" />,
};

export function ItemIcon({ name }: { name: IconName }) {
  return (
    <span className="item-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[name]}
      </svg>
    </span>
  );
}
