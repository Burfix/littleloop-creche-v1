import { describe, it, expect } from "vitest";
import { checkInviteAccountConflict } from "./invite-guard";

// Regression test for the bug that locked an owner out of their own school:
// inviting an email that already has an account used to silently overwrite
// that account's role and schoolId. Reproduced here as "owner tests a parent
// invite using their own inbox" — this must now be blocked outright.
describe("checkInviteAccountConflict", () => {
  it("blocks inviting your own email address", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "thami@example.com",
      invitedEmail: "Thami@Example.com", // case-insensitive match
      isNewAuthUser: false,
      existingUserDoc: { role: "owner", schoolId: "school-1" },
      requestedRole: "parent",
      requestedSchoolId: "school-1",
    });
    expect(result).toMatch(/own email address/);
  });

  it("blocks repurposing an existing account onto a different role", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "owner@example.com",
      invitedEmail: "existing-teacher@example.com",
      isNewAuthUser: false,
      existingUserDoc: { role: "teacher", schoolId: "school-1" },
      requestedRole: "parent",
      requestedSchoolId: "school-1",
    });
    expect(result).toMatch(/already has an account/);
  });

  it("blocks repurposing an existing account onto a different school (cross-tenant)", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "owner@school-2.example.com",
      invitedEmail: "teacher@school-1.example.com",
      isNewAuthUser: false,
      existingUserDoc: { role: "teacher", schoolId: "school-1" },
      requestedRole: "teacher",
      requestedSchoolId: "school-2",
    });
    expect(result).toMatch(/already has an account/);
  });

  it("allows a genuinely new account", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "owner@example.com",
      invitedEmail: "brand-new-parent@example.com",
      isNewAuthUser: true,
      existingUserDoc: null,
      requestedRole: "parent",
      requestedSchoolId: "school-1",
    });
    expect(result).toBeNull();
  });

  it("allows a true no-op re-invite (same role, same school — resending the setup email)", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "owner@example.com",
      invitedEmail: "teacher@example.com",
      isNewAuthUser: false,
      existingUserDoc: { role: "teacher", schoolId: "school-1" },
      requestedRole: "teacher",
      requestedSchoolId: "school-1",
    });
    expect(result).toBeNull();
  });

  it("allows re-inviting a superadmin regardless of schoolId (superadmins have no school)", () => {
    const result = checkInviteAccountConflict({
      callerEmail: "root@example.com",
      invitedEmail: "staff@example.com",
      isNewAuthUser: false,
      existingUserDoc: { role: "superadmin", schoolId: null },
      requestedRole: "superadmin",
      requestedSchoolId: undefined,
    });
    expect(result).toBeNull();
  });
});
