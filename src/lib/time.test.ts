import { describe, it, expect, vi } from "vitest";
import { formatTime } from "./time";

describe("formatTime", () => {
  it("returns 'Baru saja' for <1 minute", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = new Date(now - 10_000).toISOString();
    expect(formatTime(ts)).toBe("Baru saja");
  });

  it("returns minutes for <60 minutes", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = new Date(now - 25 * 60_000).toISOString();
    expect(formatTime(ts)).toBe("25 menit lalu");
  });

  it("returns hours for <24 hours", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = new Date(now - 3 * 60 * 60_000).toISOString();
    expect(formatTime(ts)).toBe("3 jam lalu");
  });

  it("returns days for >=24 hours", () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const ts = new Date(now - 2 * 24 * 60 * 60_000).toISOString();
    expect(formatTime(ts)).toBe("2 hari lalu");
  });

  it("returns empty string for invalid date", () => {
    expect(formatTime("invalid")).toBe("");
  });
});