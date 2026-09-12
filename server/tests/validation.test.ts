import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SUBJECTS_BY_SEM, normalizeSubjectCatalog, validateSubjectCatalog } from "../src/utils/subjects.js";
import { isValidEmail, normalizeEmail, normalizeOrderItems } from "../src/utils/validation.js";

test("email input is normalized and malformed addresses are rejected", () => {
  assert.equal(normalizeEmail("  Student@BITS-PILANI.AC.IN "), "student@bits-pilani.ac.in");
  assert.equal(normalizeEmail(null), "");
  assert.equal(isValidEmail("student@bits-pilani.ac.in"), true);
  assert.equal(isValidEmail("student@bits"), false);
  assert.equal(isValidEmail("a b@example.com"), false);
});

test("duplicate checkout lines are consolidated safely", () => {
  const result = normalizeOrderItems([
    { listing_id: "listing-1", quantity: 1 },
    { listing_id: " listing-1 ", quantity: 2 },
    { listing_id: "listing-2", quantity: 1 },
  ]);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.items, [
    { listing_id: "listing-1", quantity: 3 },
    { listing_id: "listing-2", quantity: 1 },
  ]);
});

test("checkout rejects fractional, excessive, empty, and oversized input", () => {
  assert.match(normalizeOrderItems([]).error || "", /required/i);
  assert.match(normalizeOrderItems([{ listing_id: "one", quantity: 1.5 }]).error || "", /quantity/i);
  assert.match(normalizeOrderItems([
    { listing_id: "one", quantity: 60 },
    { listing_id: "one", quantity: 60 },
  ]).error || "", /combined quantity/i);
  assert.match(normalizeOrderItems(Array.from({ length: 21 }, (_, index) => ({ listing_id: `id-${index}`, quantity: 1 }))).error || "", /maximum 20/i);
});

test("subject catalog requires all eight semesters and preserves Software Engineering", () => {
  assert.equal(validateSubjectCatalog(DEFAULT_SUBJECTS_BY_SEM), true);
  assert.equal(DEFAULT_SUBJECTS_BY_SEM.Sem7.includes("Software Engineering"), true);
  const missingSemester = { ...DEFAULT_SUBJECTS_BY_SEM };
  delete missingSemester.Sem8;
  assert.equal(validateSubjectCatalog(missingSemester), false);
});

test("subject catalog normalization trims and removes case-insensitive duplicates", () => {
  const catalog = structuredClone(DEFAULT_SUBJECTS_BY_SEM);
  catalog.Sem7 = [" Software Engineering ", "software engineering", "Computer Networks (Elective)"];
  const normalized = normalizeSubjectCatalog(catalog);
  assert.deepEqual(normalized.Sem7, ["Software Engineering", "Computer Networks (Elective)"]);
});
