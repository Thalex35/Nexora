import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sortCardsByPriority, summarizeCardUsage } from "./card-usage.ts";

const cardsMigration = readFileSync(
  new URL("../../supabase/migrations/20261009120000_create_cards.sql", import.meta.url),
  "utf8",
);

test("cards are sorted by ascending assigned priority without mutating the input", () => {
  const cards = [
    { id: "third", priority: 3 },
    { id: "first", priority: 1 },
    { id: "second", priority: 2 },
  ];

  assert.deepEqual(
    sortCardsByPriority(cards).map((card) => card.id),
    ["first", "second", "third"],
  );
  assert.deepEqual(
    cards.map((card) => card.id),
    ["third", "first", "second"],
  );
});

test("card usage summary counts only active subscriptions, active trials, and purchases this month", () => {
  const summary = summarizeCardUsage(
    [
      { status: "active", is_free_trial: true },
      { status: "active", is_free_trial: false },
      { status: "cancelled", is_free_trial: true },
    ],
    [
      { purchase_date: "2026-10-01" },
      { purchase_date: "2026-09-30" },
      { purchase_date: "invalid" },
    ],
    new Date(2026, 9, 8),
  );

  assert.deepEqual(summary, {
    activeSubscriptions: 2,
    activeTrials: 1,
    purchasesThisMonth: 1,
  });
});

test("Cards tables are owner scoped and omit sensitive card credentials", () => {
  assert.equal((cardsMigration.match(/enable row level security/gi) ?? []).length, 3);
  assert.ok((cardsMigration.match(/auth\.uid\(\)\s*=\s*user_id/gi) ?? []).length >= 6);
  assert.match(cardsMigration, /unique\s*\(\s*user_id\s*,\s*priority\s*\)/i);
  assert.match(cardsMigration, /foreign key\s*\(\s*card_id\s*,\s*user_id\s*\)/i);
  assert.doesNotMatch(
    cardsMigration,
    /\b(card_number|pan|cvv|cvc|pin|expiration_date|expiry_month|expiry_year)\b/i,
  );
});
