import { randomInt } from "node:crypto";
import { WORDS } from "./words.js";

export const ID_WORD_COUNT = 4;

// A valid id is exactly ID_WORD_COUNT lowercase words joined by hyphens,
// e.g. "moon-cat-river-fox". This is the route-level format gate; the database
// lookup is the source of truth for existence.
export const ID_PATTERN = new RegExp(
  `^[a-z]+(?:-[a-z]+){${ID_WORD_COUNT - 1}}$`,
);

/**
 * Generates a human-readable id: ID_WORD_COUNT random words from the list,
 * hyphen-joined. Uses crypto randomInt for uniform, unbiased, unguessable
 * selection (~41 bits with the 1295-word list).
 */
export function generateId(): string {
  const words: string[] = [];
  for (let i = 0; i < ID_WORD_COUNT; i++) {
    words.push(WORDS[randomInt(WORDS.length)]);
  }
  return words.join("-");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * Inserts a row keyed by a freshly generated id, retrying with a new id if the
 * insert hits a unique-key collision. Word ids have far less entropy than the
 * old 21-char nanoids, so collisions — while rare at ~41 bits — are worth
 * handling rather than surfacing as a 500.
 */
export async function withUniqueId<T>(
  insert: (id: string) => Promise<T>,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const id = generateId();
    try {
      await insert(id);
      return id;
    } catch (err) {
      if (isUniqueViolation(err) && i < attempts - 1) continue;
      throw err;
    }
  }
  // Unreachable: the loop either returns or throws on the final attempt.
  throw new Error("Failed to generate a unique id");
}
