import { describe, it, expect } from "vitest";
import { stripUndefinedDeep } from "./school-launch-admin";

// Regression test for the "Couldn't save. Please try again." bug on the
// admin Launch tab's Specialist/Payment/Session/TaskOverride forms: the
// Firestore web SDK throws synchronously on ANY `undefined` in a write
// payload, including nested inside objects/arrays, not just top-level
// fields. Every editor form nests optional blank fields as literal
// `undefined` (e.g. `email: email.trim() || undefined`) inside an object
// (specialist, payment) or array (sessions), so this needs to actually be
// deep, not just top-level.
describe("stripUndefinedDeep", () => {
  it("removes undefined keys from a flat object", () => {
    expect(stripUndefinedDeep({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("removes undefined keys nested inside an object (the specialist/payment case)", () => {
    const specialist = {
      id: "abc",
      name: "Thamsanqa Gumpo",
      role: "Implementation Specialist",
      initials: "TG",
      email: undefined,
      phone: undefined,
      supportHours: undefined,
    };
    expect(stripUndefinedDeep({ specialist })).toEqual({
      specialist: {
        id: "abc",
        name: "Thamsanqa Gumpo",
        role: "Implementation Specialist",
        initials: "TG",
      },
    });
  });

  it("removes undefined entries from arrays and undefined keys inside array elements (the sessions case)", () => {
    const sessions = [
      { id: "1", title: "Setup call", meetingLink: undefined, notes: "Went well" },
      undefined,
    ];
    expect(stripUndefinedDeep(sessions)).toEqual([
      { id: "1", title: "Setup call", notes: "Went well" },
    ]);
  });

  it("leaves Date instances untouched instead of walking into them as plain objects", () => {
    const date = new Date("2026-07-15T00:00:00.000Z");
    expect(stripUndefinedDeep({ paidAt: date })).toEqual({ paidAt: date });
  });

  it("preserves null (a valid Firestore value, unlike undefined)", () => {
    expect(stripUndefinedDeep({ blockingReason: null })).toEqual({ blockingReason: null });
  });

  it("passes primitives through unchanged", () => {
    expect(stripUndefinedDeep("hello")).toBe("hello");
    expect(stripUndefinedDeep(42)).toBe(42);
    expect(stripUndefinedDeep(null)).toBe(null);
  });
});
