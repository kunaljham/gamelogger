import { describe, it, expect } from "vitest";
import { preserveNewlines } from "./markdown";

const NBSP = "\u00A0";

describe("preserveNewlines", () => {
  it("returns plain text unchanged", () => {
    expect(preserveNewlines("hello world")).toBe("hello world");
  });

  it("preserves a single newline between lines", () => {
    expect(preserveNewlines("line1\nline2")).toBe("line1\nline2");
  });

  it("replaces one empty line (double newline) with nbsp", () => {
    expect(preserveNewlines("line1\n\nline2")).toBe(`line1\n${NBSP}\nline2`);
  });

  it("replaces multiple empty lines with nbsp on each", () => {
    expect(preserveNewlines("line1\n\n\nline2")).toBe(
      `line1\n${NBSP}\n${NBSP}\nline2`
    );
  });

  it("handles leading empty lines", () => {
    expect(preserveNewlines("\n\nhello")).toBe(`${NBSP}\n${NBSP}\nhello`);
  });

  it("handles trailing empty lines", () => {
    expect(preserveNewlines("hello\n\n")).toBe(`hello\n${NBSP}\n${NBSP}`);
  });

  it("handles only newlines", () => {
    expect(preserveNewlines("\n\n\n")).toBe(`${NBSP}\n${NBSP}\n${NBSP}\n${NBSP}`);
  });

  it("does not modify lines with whitespace", () => {
    expect(preserveNewlines("line1\n  \nline2")).toBe("line1\n  \nline2");
  });

  it("handles empty string", () => {
    expect(preserveNewlines("")).toBe(NBSP);
  });

  it("preserves markdown syntax", () => {
    const input = "**bold**\n\n- item 1\n- item 2";
    const expected = `**bold**\n${NBSP}\n- item 1\n- item 2`;
    expect(preserveNewlines(input)).toBe(expected);
  });
});
