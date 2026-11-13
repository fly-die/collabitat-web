import { describe, expect, it } from "vitest";
import { iconFor } from "./item-icons";

describe("item icons", () => {
  it.each([
    ["Take out the trash", "trash"],
    ["Müll rausbringen", "trash"],
    ["Altglas entsorgen", "trash"],
    ["Clean the bathroom", "bath"],
    ["Badezimmer putzen", "bath"],
    ["Hoover the hallway", "broom"],
    ["Staubsaugen", "broom"],
    ["Water the plants", "plant"],
    ["Pflanzen giessen", "plant"],
    ["Descale the kettle", "kitchen"],
    ["Geschirr abwaschen", "kitchen"],
    ["Wäsche waschen", "laundry"],
    ["Buy toilet paper", "cart"],
    ["Migros groceries", "cart"],
    ["Toilet paper and soap", "cart"],
    ["Pizza night", "pizza"],
    ["Flammkuchen", "pizza"],
    ["Spaghetti Carbonara", "bowl"],
    ["Dentist", "tooth"],
    ["Zahnarzt Noëla", "tooth"],
    ["Geburtstag Lea", "cake"],
    ["Znacht", "food"],
    ["Bier für die Party", "drink"],
    ["Miete November", "home"],
    ["Strom EWZ", "bolt"],
    ["Internet October", "wifi"],
  ])("gives %j the %s icon", (title, icon) => {
    expect(iconFor(title, "chore")).toBe(icon);
  });

  it.each(["Fix the doorbell", "Concert tickets", "Current account", "Parent evening"])(
    "falls back when nothing fits: %j",
    (title) => {
      expect(iconFor(title, "receipt")).toBe("receipt");
    },
  );
});
