import { describe, it, expectTypeOf } from "vitest";
import type { ApiResponse, ErrorCode, Paste } from "./types.js";

describe("ApiResponse<T> type", () => {
  it("accepts a success response shape", () => {
    expectTypeOf<{ data: { status: "ok" }; error: null }>().toMatchTypeOf<
      ApiResponse<{ status: "ok" }>
    >();
  });

  it("accepts an error response shape", () => {
    expectTypeOf<{
      data: null;
      error: { message: string; code: ErrorCode };
    }>().toMatchTypeOf<ApiResponse<unknown>>();
  });

  it("is a discriminated union — data and error are mutually exclusive", () => {
    type SuccessBranch = Extract<ApiResponse<string>, { data: string }>;
    type ErrorBranch = Extract<ApiResponse<string>, { data: null }>;

    expectTypeOf<SuccessBranch>().toHaveProperty("data");
    expectTypeOf<SuccessBranch>().toHaveProperty("error");
    expectTypeOf<ErrorBranch>().toHaveProperty("data");
    expectTypeOf<ErrorBranch>().toHaveProperty("error");
  });
});

describe("ErrorCode type", () => {
  it("accepts valid error codes", () => {
    expectTypeOf<"PASTE_NOT_FOUND">().toMatchTypeOf<ErrorCode>();
    expectTypeOf<"RATE_LIMITED">().toMatchTypeOf<ErrorCode>();
    expectTypeOf<"VALIDATION_ERROR">().toMatchTypeOf<ErrorCode>();
    expectTypeOf<"INTERNAL_ERROR">().toMatchTypeOf<ErrorCode>();
  });
});

describe("Paste interface", () => {
  it("has the expected shape", () => {
    expectTypeOf<Paste>().toHaveProperty("id");
    expectTypeOf<Paste>().toHaveProperty("content");
    expectTypeOf<Paste>().toHaveProperty("createdAt");
    expectTypeOf<Paste>().toHaveProperty("updatedAt");
  });
});
