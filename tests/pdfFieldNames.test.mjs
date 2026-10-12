import assert from "node:assert/strict";
import test from "node:test";
import { createPdfFieldNames } from "../packages/pdf-engine/src/pdfFieldNames.ts";

test("field names detect exact and terminal-prefix collisions without rejecting sibling groups", () => {
  const names = createPdfFieldNames();
  names.add("claim.name");
  assert.equal(names.conflicts("claim"), true);
  assert.equal(names.conflicts("claim.name"), true);
  assert.equal(names.conflicts("claim.name.first"), true);
  assert.equal(names.conflicts("claim.number"), false);
  assert.equal(names.conflicts("claims.name"), false);
  names.add("claim.number");
  assert.equal(names.available("claim.name"), "claim_2.name");
  assert.equal(names.available("claim.number"), "claim_2.number");
  assert.equal(names.available("claim.name"), "claim_3.name");
  assert.equal(names.available("claim"), "claim_4");
});

test("indexed allocation preserves lowest available suffixes with preexisting names and prefixes", () => {
  const names = createPdfFieldNames();
  const existing = new Set(["claim", "claim_2.name", "claim_4", "claim_6.name.first"]);
  for (const name of existing) {
    names.add(name);
  }
  const requests = [
    "claim.name",
    "claim.name",
    "claim.name",
    "claim.name",
    "claim_2.name",
    "claim_2.name",
    "claim.other",
    "claim",
    "claim",
    "free.field",
    "free.other",
    "free",
  ];
  for (const original of requests) {
    let expected = original;
    for (
      let suffix = 2;
      [...existing].some(
        (name) =>
          name === expected || name.startsWith(`${expected}.`) || expected.startsWith(`${name}.`),
      );
      suffix++
    ) {
      const [first, ...rest] = original.split(".");
      expected = [`${first}_${suffix}`, ...rest].join(".");
    }
    assert.equal(names.available(original), expected);
    existing.add(expected);
  }
});

test("large field sets and repeated collisions retain deterministic names", () => {
  const names = createPdfFieldNames();
  for (let index = 0; index < 20_000; index++) {
    names.add(`section.field${index}`);
  }
  for (let index = 0; index < 20_000; index++) {
    assert.equal(names.conflicts(`section.field${index}`), true);
    assert.equal(names.conflicts(`section.other${index}`), false);
  }
  assert.equal(names.conflicts("section"), true);
  for (let suffix = 2; suffix <= 2_000; suffix++) {
    assert.equal(names.available("section.field0"), `section_${suffix}.field0`);
  }
});
