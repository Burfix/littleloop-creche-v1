/**
 * One-time demo data seeder.
 * POST /api/seed
 * Header: x-bootstrap-secret: <BOOTSTRAP_SECRET>
 *
 * Creates:
 *  - 1 school: Sunflower House (slug: sunflower)
 *  - 5 classrooms
 *  - 2 owners, 8 teachers (Firebase Auth + Firestore)
 *  - 50 children (10 per class)
 *  - 35 parents (some shared across siblings)
 *  - Enrollments linking children to parents
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEMO_PASSWORD = "Demo2026!";
const SCHOOL_ID = "sunflower-demo";
const SCHOOL_SLUG = "sunflower";

const CLASSES = [
  { id: "cls-babies",   name: "Babies",      ageMin: 0,  ageMax: 1,  capacity: 10 },
  { id: "cls-toddlers", name: "Toddlers",    ageMin: 1,  ageMax: 2,  capacity: 10 },
  { id: "cls-walkers",  name: "Walkers",     ageMin: 2,  ageMax: 3,  capacity: 10 },
  { id: "cls-preschool",name: "Pre-School",  ageMin: 3,  ageMax: 4,  capacity: 10 },
  { id: "cls-kinder",   name: "Kindergarten",ageMin: 4,  ageMax: 5,  capacity: 10 },
];

const OWNERS = [
  { email: "owner1@sunflower.demo", displayName: "Nomsa Dlamini" },
  { email: "owner2@sunflower.demo", displayName: "Sipho Mokoena" },
];

const TEACHERS = [
  { email: "teacher1@sunflower.demo", displayName: "Zanele Khumalo", classId: "cls-babies" },
  { email: "teacher2@sunflower.demo", displayName: "Thabo Nkosi",    classId: "cls-babies" },
  { email: "teacher3@sunflower.demo", displayName: "Lindiwe Zulu",   classId: "cls-toddlers" },
  { email: "teacher4@sunflower.demo", displayName: "Bongani Sithole", classId: "cls-toddlers" },
  { email: "teacher5@sunflower.demo", displayName: "Ayanda Mthembu", classId: "cls-walkers" },
  { email: "teacher6@sunflower.demo", displayName: "Nokwanda Cele",  classId: "cls-preschool" },
  { email: "teacher7@sunflower.demo", displayName: "Siyanda Ndlovu", classId: "cls-kinder" },
  { email: "teacher8@sunflower.demo", displayName: "Thandeka Ntuli", classId: "cls-kinder" },
];

const KIDS_PER_CLASS: Record<string, { first: string; last: string; dob: string }[]> = {
  "cls-babies": [
    { first: "Amara",   last: "Okafor",   dob: "2025-10-01" },
    { first: "Liam",    last: "Botha",    dob: "2025-09-15" },
    { first: "Zoe",     last: "van Wyk",  dob: "2025-08-20" },
    { first: "Ethan",   last: "Dube",     dob: "2025-11-03" },
    { first: "Nia",     last: "Petersen", dob: "2025-07-22" },
    { first: "Remi",    last: "Adams",    dob: "2025-10-30" },
    { first: "Kai",     last: "Singh",    dob: "2025-09-05" },
    { first: "Isla",    last: "Fourie",   dob: "2025-08-11" },
    { first: "Theo",    last: "Naidoo",   dob: "2025-11-18" },
    { first: "Maya",    last: "Coetzee",  dob: "2025-07-07" },
  ],
  "cls-toddlers": [
    { first: "Luca",    last: "Venter",   dob: "2024-05-14" },
    { first: "Sasha",   last: "Mahlangu", dob: "2024-03-22" },
    { first: "Aiden",   last: "Kruger",   dob: "2024-06-09" },
    { first: "Chloe",   last: "Molefe",   dob: "2024-04-17" },
    { first: "Noah",    last: "du Plessis",dob: "2024-07-31" },
    { first: "Amira",   last: "Jacobs",   dob: "2024-02-28" },
    { first: "Felix",   last: "Khumalo",  dob: "2024-05-05" },
    { first: "Sofia",   last: "Swart",    dob: "2024-08-19" },
    { first: "Oliver",  last: "Masondo",  dob: "2024-01-14" },
    { first: "Layla",   last: "Nel",      dob: "2024-06-25" },
  ],
  "cls-walkers": [
    { first: "Leo",     last: "Pretorius",dob: "2023-04-10" },
    { first: "Ava",     last: "Mthembu",  dob: "2023-06-18" },
    { first: "Eli",     last: "Barnard",  dob: "2023-03-27" },
    { first: "Mia",     last: "Cele",     dob: "2023-07-04" },
    { first: "Jack",    last: "Mokoena",  dob: "2023-05-21" },
    { first: "Zara",    last: "Smit",     dob: "2023-08-15" },
    { first: "James",   last: "Dlamini",  dob: "2023-02-09" },
    { first: "Lily",    last: "Ferreira", dob: "2023-09-01" },
    { first: "Hugo",    last: "Ndlovu",   dob: "2023-04-30" },
    { first: "Grace",   last: "Visser",   dob: "2023-06-12" },
  ],
  "cls-preschool": [
    { first: "Ethan",   last: "Mkhize",   dob: "2022-03-15" },
    { first: "Emma",    last: "Joubert",  dob: "2022-05-22" },
    { first: "Lucas",   last: "Shabalala",dob: "2022-02-08" },
    { first: "Olivia",  last: "Human",    dob: "2022-07-19" },
    { first: "Mason",   last: "Ntuli",    dob: "2022-04-04" },
    { first: "Hannah",  last: "Bester",   dob: "2022-06-30" },
    { first: "Aiden",   last: "Kgosi",    dob: "2022-01-25" },
    { first: "Ella",    last: "Meyer",    dob: "2022-08-07" },
    { first: "Carter",  last: "Sithole",  dob: "2022-03-31" },
    { first: "Nora",    last: "de Wet",   dob: "2022-09-14" },
  ],
  "cls-kinder": [
    { first: "Sebastian",last: "Louw",    dob: "2021-02-14" },
    { first: "Zoe",     last: "Zwane",    dob: "2021-04-20" },
    { first: "Jackson", last: "Liebenberg",dob:"2021-01-09" },
    { first: "Scarlett",last: "Mahomed",  dob: "2021-05-17" },
    { first: "Aiden",   last: "van Niekerk",dob:"2021-03-03"},
    { first: "Victoria",last: "Gumede",   dob: "2021-06-28" },
    { first: "Mateo",   last: "Steyn",    dob: "2021-02-22" },
    { first: "Penelope",last: "Mosia",    dob: "2021-07-11" },
    { first: "Henry",   last: "Booysen",  dob: "2021-01-30" },
    { first: "Layla",   last: "Mabunda",  dob: "2021-05-05" },
  ],
};

const PARENT_NAMES = [
  "Priya Naidoo","David Botha","Sarah van Wyk","Mohammed Cassim","Gugu Zulu",
  "Johan Fourie","Lindiwe Dube","Pieter Venter","Fatima Hendricks","Kagiso Sithole",
  "Anneke Smit","Sibusiso Mthembu","Karen Pretorius","Siphamandla Khumalo","Tanya Nel",
  "Rethabile Mokoena","André du Plessis","Zanele Cele","Michael Adams","Nokuthula Ntuli",
  "Elena Coetzee","Thulisile Ndlovu","Werner Steyn","Pamela Jacobs","Riaan Kruger",
  "Nomvula Dlamini","Christelle Meyer","Lungelo Shabalala","Anita Singh","Roelof Joubert",
  "Thandi Mahlangu","Greg Ferreira","Ntombi Mkhize","Elmarie Louw","Busi Zwane",
];

async function getOrCreateUser(
  auth: ReturnType<typeof adminAuth>,
  db: ReturnType<typeof adminDb>,
  email: string,
  displayName: string,
  role: string,
  schoolId: string | null,
  extra: Record<string, unknown> = {}
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const user = await auth.createUser({ email, password: DEMO_PASSWORD, displayName, emailVerified: true });
    await db.collection("users").doc(user.uid).set({
      uid: user.uid, email, displayName, role,
      schoolId: schoolId ?? null,
      createdAt: FieldValue.serverTimestamp(),
      ...extra,
    });
    return user.uid;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret");
  if (!secret || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = adminDb();
    const auth = adminAuth();
    const log: string[] = [];

    // ── School ──────────────────────────────────────────────────────────────
    await db.collection("schools").doc(SCHOOL_ID).set({
      id: SCHOOL_ID, name: "Sunflower House", slug: SCHOOL_SLUG,
      address: "12 Jacaranda Avenue, Pretoria, 0181",
      phone: "+27 12 555 0100", email: "hello@sunflower.demo",
      capacity: 50, staffCount: 10,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    log.push("✓ School created");

    // ── Owners ───────────────────────────────────────────────────────────────
    const ownerIds: string[] = [];
    for (const o of OWNERS) {
      const uid = await getOrCreateUser(auth, db, o.email, o.displayName, "owner", SCHOOL_ID);
      ownerIds.push(uid);
    }
    log.push(`✓ ${OWNERS.length} owners created`);

    // ── Classrooms ───────────────────────────────────────────────────────────
    const teacherIdsByClass: Record<string, string[]> = {};
    for (const cls of CLASSES) teacherIdsByClass[cls.id] = [];

    for (const t of TEACHERS) {
      const uid = await getOrCreateUser(auth, db, t.email, t.displayName, "teacher", SCHOOL_ID,
        { classroomId: t.classId }
      );
      teacherIdsByClass[t.classId] = [...(teacherIdsByClass[t.classId] ?? []), uid];
    }

    for (const cls of CLASSES) {
      await db.collection("classrooms").doc(cls.id).set({
        id: cls.id, schoolId: SCHOOL_ID, branchId: SCHOOL_ID,
        name: cls.name, ageGroupMin: cls.ageMin, ageGroupMax: cls.ageMax,
        capacity: cls.capacity, teacherIds: teacherIdsByClass[cls.id] ?? [],
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    log.push(`✓ ${CLASSES.length} classrooms + ${TEACHERS.length} teachers created`);

    // ── Parents ──────────────────────────────────────────────────────────────
    const parentUids: string[] = [];
    for (let i = 0; i < PARENT_NAMES.length; i++) {
      const displayName = PARENT_NAMES[i];
      const slug = displayName.toLowerCase().replace(/\s+/g, ".");
      const email = `${slug}@sunflower.demo`;
      const uid = await getOrCreateUser(auth, db, email, displayName, "parent", SCHOOL_ID);
      parentUids.push(uid);
    }
    log.push(`✓ ${PARENT_NAMES.length} parents created`);

    // ── Children ─────────────────────────────────────────────────────────────
    let childCount = 0;
    let parentIdx = 0;
    const batch = db.batch();

    for (const cls of CLASSES) {
      const kids = KIDS_PER_CLASS[cls.id] ?? [];
      for (let k = 0; k < kids.length; k++) {
        const kid = kids[k];
        const childId = `child-${cls.id}-${k}`;
        // Assign 1-2 parents; every 4 kids share a parent (siblings scenario)
        const p1 = parentUids[parentIdx % parentUids.length];
        const p2 = k % 4 === 3 ? parentUids[(parentIdx + 1) % parentUids.length] : undefined;
        if (k % 2 === 0) parentIdx++;

        const parentIds = p2 ? [p1, p2] : [p1];

        batch.set(db.collection("children").doc(childId), {
          id: childId, schoolId: SCHOOL_ID, branchId: SCHOOL_ID,
          classId: cls.id, classroomId: cls.id,
          firstName: kid.first, lastName: kid.last,
          dateOfBirth: kid.dob, enrolledAt: "2025-01-15",
          parentIds, photoConsent: true,
          allergies: k % 5 === 0 ? "Nut allergy — no peanuts or tree nuts" : "",
          notes: "",
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        childCount++;
      }
    }
    await batch.commit();
    log.push(`✓ ${childCount} children created`);

    return NextResponse.json({ success: true, log, password: DEMO_PASSWORD });
  } catch (err: any) {
    console.error("[seed]", err);
    return NextResponse.json({ error: err.message ?? "Seed failed" }, { status: 500 });
  }
}
