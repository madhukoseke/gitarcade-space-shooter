import { describe, expect, it } from "vitest";
import { normalizeUsername } from "@/lib/github/validation";

describe("normalizeUsername", () => {
  it.each([
    ["octocat", "octocat"],
    ["  octocat  ", "octocat"],
    ["@octocat", "octocat"],
    ["https://github.com/octocat", "octocat"],
    ["https://github.com/octocat/", "octocat"],
    ["http://www.github.com/octo-cat", "octo-cat"],
    ["github.com/octocat", "octocat"],
    ["a", "a"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeUsername(input)).toEqual({ ok: true, username: expected });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    [null, "empty"],
    ["-leading", "invalid"],
    ["trailing-", "invalid"],
    ["double--hyphen", "invalid"],
    ["has space", "invalid"],
    ["a".repeat(40), "invalid"],
    ["<script>alert(1)</script>", "invalid"],
    ["https://github.com/", "invalid"],
    ["https://gitlab.com/octocat", "unsupported_url"],
    ["https://evil.example/github.com/octocat", "unsupported_url"],
    ["javascript://github.com/octocat", "unsupported_url"],
    ["https://github.com/settings", "unsupported_url"],
    ["https://github.com/octocat/hello-world", "repo_url"],
    ["octocat/hello-world", "repo_url"],
  ])("rejects %s as %s", (input, reason) => {
    const result = normalizeUsername(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
      expect(result.message.length).toBeGreaterThan(5);
    }
  });
});
