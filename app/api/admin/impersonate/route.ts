import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const authorized = await requireSuperAdmin(req);
    if ("error" in authorized) return authorized.error;

    const { targetUid } = await req.json();

    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "targetUid is required" }, { status: 400 });
    }

    // Prevent impersonating yourself (unnecessary)
    if (targetUid === authorized.uid) {
      return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
    }

    // Verify the target user exists
    const targetSnap = await authorized.db.collection("users").doc(targetUid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const targetData = targetSnap.data()!;

    // Generate a custom token for the target user
    // Custom tokens expire after 1 hour — sufficient for a review session
    const customToken = await authorized.auth.createCustomToken(targetUid, {
      impersonatedBy: authorized.uid,
    });

    return NextResponse.json({
      customToken,
      role: targetData.role,
      displayName: targetData.displayName ?? targetData.email ?? targetUid,
    });
  } catch (err) {
    console.error("Impersonate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create impersonation token" },
      { status: 500 }
    );
  }
}
