import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAppUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  try {
    const authorized = await requireAppUser(req);
    if ("error" in authorized) return authorized.error;

    const { schoolId, firstName, lastName, dateOfBirth, allergies, notes, photoConsent } = await req.json();
    const trimmedFirstName = typeof firstName === "string" ? firstName.trim() : "";
    const trimmedLastName = typeof lastName === "string" ? lastName.trim() : "";

    if (!schoolId || !trimmedFirstName || !trimmedLastName || !dateOfBirth) {
      return NextResponse.json({ error: "First name, last name and date of birth are required" }, { status: 400 });
    }

    const role = authorized.user?.role;
    const callerSchoolId = authorized.user?.schoolId;
    const canCreate = role === "superadmin" || (role === "owner" && callerSchoolId === schoolId);

    if (!canCreate) {
      return NextResponse.json({ error: "You do not have permission to add children for this school" }, { status: 403 });
    }

    const db = authorized.db;
    const schoolRef = db.collection("schools").doc(schoolId);
    const schoolSnap = await schoolRef.get();

    if (!schoolSnap.exists) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const school = schoolSnap.data();
    let branch = Array.isArray(school?.branches) ? school.branches[0] : null;

    if (!branch?.id) {
      branch = { id: "main", schoolId, name: "Main" };
      await schoolRef.update({ branches: FieldValue.arrayUnion(branch) });
    }

    const classSnap = await db.collection("classes")
      .where("schoolId", "==", schoolId)
      .limit(1)
      .get();

    let classId = classSnap.docs[0]?.id;
    if (!classId) {
      const classRef = db.collection("classes").doc();
      classId = classRef.id;
      await classRef.set({
        id: classId,
        schoolId,
        branchId: branch.id,
        name: "Default class",
        ageGroupMin: 0,
        ageGroupMax: 6,
        capacity: 30,
        teacherIds: [],
      });
    }

    const childRef = db.collection("children").doc();
    const now = new Date().toISOString();
    const child = {
      id: childRef.id,
      schoolId,
      branchId: branch.id,
      classId,
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      dateOfBirth,
      parentIds: [],
      allergies: typeof allergies === "string" ? allergies.trim() : "",
      notes: typeof notes === "string" ? notes.trim() : "",
      photoConsent: Boolean(photoConsent),
      enrolledAt: now,
    };

    await childRef.set(child);

    return NextResponse.json({ success: true, child });
  } catch (err) {
    console.error("Create child error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add child" },
      { status: 500 }
    );
  }
}
