import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "@/lib/url";

describe("safeHttpUrl", () => {
  it("accepts absolute http and https URLs", () => {
    expect(safeHttpUrl("https://lansstyrelsen.se/reservat")).toBe(
      "https://lansstyrelsen.se/reservat",
    );
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("preserves query strings and paths", () => {
    expect(safeHttpUrl("https://x.se/a?b=1&c=2#frag")).toBe(
      "https://x.se/a?b=1&c=2#frag",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(safeHttpUrl("  https://x.se  ")).toBe("https://x.se/");
  });

  it("rejects javascript: and data: scheme injection", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects non-http(s) schemes", () => {
    expect(safeHttpUrl("ftp://x.se/file")).toBeNull();
    expect(safeHttpUrl("mailto:a@b.se")).toBeNull();
    expect(safeHttpUrl("tel:+46123")).toBeNull();
  });

  it("rejects scheme-less, empty and non-string values", () => {
    expect(safeHttpUrl("example.com")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
  });
});
