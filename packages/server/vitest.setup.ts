// Provide a default DATABASE_URL for tests so @fastify/env validation
// passes even when no .env file exists (e.g., in CI).
process.env.DATABASE_URL ??= "postgres://pastebin:pastebin@localhost:5432/pastebin";