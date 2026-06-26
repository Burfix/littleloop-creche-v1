import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";

type RouteContext = {
  params: Promise<{ uid: string }>;
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const authorized = await requireSuperAdmin(req);
    if ("error" in authorized) return authorized.error;

    const { uid } = await context.params;
    const { displayName } = await req.json();
    const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";

    if (!trimmedDisplayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    const userRef = authorized.db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await Promise.all([
      userRef.update({ displayName: trimmedDisplayName }),
      authorized.auth.updateUser(uid, { displayName: trimmedDisplayName }),
    ]);

    return NextResponse.json({ success: true, uid, displayName: trimmedDisplayName });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const authorized = await requireSuperAdmin(req);
    if ("error" in authorized) return authorized.error;

    const { uid } = await context.params;

    if (uid === authorized.uid) {
      return NextResponse.json({ error: "You cannot delete your own active account" }, { status: 400 });
    }

    const userRef = authorized.db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await userRef.delete();

    try {
      await authorized.auth.deleteUser(uid);
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
      if (code !== "auth/user-not-found") throw err;
    }

    return NextResponse.json({ success: true, uid });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete user" },
      { status: 500 }
    );
  }
}
