// Extracted from app/api/invite/route.ts so the account-safety logic has a
// direct unit test rather than only living inline in an API route.
//
// Background: the invite endpoint resolves an invited email to a Firebase
// Auth uid and then merge-writes { role, schoolId, ... } onto that uid's
// Firestore user document. Before this guard existed, that meant inviting
// ANY email address that already had an account — including the caller's
// own, mid-testing — silently overwrote that account's real role and
// schoolId. This is what locked an owner out of their own account: testing
// a parent invite and a teacher invite with the same real inbox flipped
// their own role twice, losing "owner" entirely.
export interface ExistingUserDoc {
  role?: string;
  schoolId?: string | null;
}

export interface InviteAccountGuardInput {
  callerEmail?: string | null;
  invitedEmail: string;
  isNewAuthUser: boolean;
  existingUserDoc: ExistingUserDoc | null;
  requestedRole: string;
  requestedSchoolId?: string | null;
}

/**
 * Returns an error message if this invite should be blocked, or null if it's
 * safe to proceed. Safe cases: a genuinely new account, or a true no-op
 * re-invite (same role, same school — just resending the setup email).
 * Everything else (self-invite, or repurposing an existing account onto a
 * different role/school) is blocked — that kind of change must be an
 * explicit action, never a side effect of "invite user".
 */
export function checkInviteAccountConflict(input: InviteAccountGuardInput): string | null {
  const { callerEmail, invitedEmail, isNewAuthUser, existingUserDoc, requestedRole, requestedSchoolId } = input;

  if (callerEmail && invitedEmail.toLowerCase() === callerEmail.toLowerCase()) {
    return "You can't invite your own email address.";
  }

  if (!isNewAuthUser && existingUserDoc) {
    const sameRole = existingUserDoc.role === requestedRole;
    const sameSchool = requestedRole === "superadmin" || existingUserDoc.schoolId === requestedSchoolId;
    if (!sameRole || !sameSchool) {
      return `${invitedEmail} already has an account (role: ${existingUserDoc.role ?? "unknown"}). ` +
        "Changing an existing user's role or school isn't done through invites — update their account directly instead.";
    }
  }

  return null;
}
