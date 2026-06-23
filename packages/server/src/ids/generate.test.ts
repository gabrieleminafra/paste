import { describe, it, expect } from "vitest";
import { generateId, ID_PATTERN, ID_WORD_COUNT, withUniqueId } from "./generate.js";
import { WORDS } from "./words.js";

describe("generateId", () => {
  it("produces ID_WORD_COUNT lowercase words joined by hyphens", () => {
    const id = generateId();
    const parts = id.split("-");
    expect(parts).toHaveLength(ID_WORD_COUNT);
    for (const part of parts) {
      expect(WORDS).toContain(part);
    }
  });

  it("matches ID_PATTERN", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateId()).toMatch(ID_PATTERN);
    }
  });

  it("is overwhelmingly likely to produce distinct ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    expect(ids.size).toBe(500);
  });
});

describe("ID_PATTERN", () => {
  it("accepts a well-formed word id", () => {
    expect(ID_PATTERN.test("moon-cat-river-fox")).toBe(true);
  });

  it("rejects wrong word counts, uppercase, and stray characters", () => {
    expect(ID_PATTERN.test("moon-cat-river")).toBe(false); // too few
    expect(ID_PATTERN.test("moon-cat-river-fox-owl")).toBe(false); // too many
    expect(ID_PATTERN.test("Moon-cat-river-fox")).toBe(false); // uppercase
    expect(ID_PATTERN.test("moon-cat-river-fox!")).toBe(false); // stray char
    expect(ID_PATTERN.test("short")).toBe(false); // single word
  });
});

describe("withUniqueId", () => {
  it("returns the id on a successful insert", async () => {
    const id = await withUniqueId(async () => undefined);
    expect(id).toMatch(ID_PATTERN);
  });

  it("retries on a unique-violation then succeeds", async () => {
    let calls = 0;
    const id = await withUniqueId(async () => {
      calls++;
      if (calls < 3) throw { code: "23505" };
    });
    expect(calls).toBe(3);
    expect(id).toMatch(ID_PATTERN);
  });

  it("rethrows non-unique errors immediately", async () => {
    let calls = 0;
    await expect(
      withUniqueId(async () => {
        calls++;
        throw { code: "23502" }; // not_null_violation
      }),
    ).rejects.toMatchObject({ code: "23502" });
    expect(calls).toBe(1);
  });

  it("gives up after the attempt limit on persistent collisions", async () => {
    let calls = 0;
    await expect(
      withUniqueId(async () => {
        calls++;
        throw { code: "23505" };
      }, 3),
    ).rejects.toBeTruthy();
    expect(calls).toBe(3);
  });
});
