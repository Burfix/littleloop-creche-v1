/**
 * POST /api/seed/daily
 * Seeds a realistic "3pm on a school day" snapshot for Sunflower House.
 * Header: x-bootstrap-secret: <BOOTSTRAP_SECRET>
 *
 * Creates:
 *  - Attendance (DailyUpdate): 47 present, 3 absent, 5 already picked up
 *  - Learning journal entries per class (morning activities)
 *  - Invoices: last month paid/overdue + this month paid/outstanding
 *  - Messages: 4 parent-teacher threads
 *  - 2 incident reports (minor fall, bumped head)
 *  - 4 medical records (asthma, nut allergy, lactose intolerance, halaal)
 *  - 4 waiting list entries
 *  - 2 admissions in pipeline
 *  - HR profiles for all teachers + 1 pending leave request
 */
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCHOOL_ID = "sunflower-demo";

const TODAY = new Date();
const TODAY_STR = TODAY.toISOString().slice(0, 10);
const LAST_MONTH = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1, 1)
  .toISOString().slice(0, 7);
const THIS_MONTH = TODAY.toISOString().slice(0, 7);

const CLASS_TEACHERS: Record<string, string> = {
  "cls-babies":    "teacher1@sunflower.demo",
  "cls-toddlers":  "teacher3@sunflower.demo",
  "cls-walkers":   "teacher5@sunflower.demo",
  "cls-preschool": "teacher6@sunflower.demo",
  "cls-kinder":    "teacher7@sunflower.demo",
};

const ACTIVITIES: Record<string, string[]> = {
  "cls-babies":    ["Tummy time", "Sensory play — soft textures", "Lullaby circle", "Afternoon nap"],
  "cls-toddlers":  ["Morning circle", "Playdough exploration", "Outdoor time", "Post-nap story"],
  "cls-walkers":   ["Morning movement", "Painting", "Sand & water play", "Storytime"],
  "cls-preschool": ["Circle time", "Letter of the week: S", "Outdoor obstacle course", "Show & tell"],
  "cls-kinder":    ["Morning journal", "Maths with blocks", "Volcano science experiment", "Reading groups"],
};

const MOODS = ["happy", "happy", "happy", "excited", "neutral", "neutral", "tired", "happy", "happy", "happy"] as const;
const ABSENT_INDICES = new Set([2, 7, 13]);
const SIGNED_OUT_INDICES = new Set([0, 4, 18, 26, 37]);

function ts(h: number, m = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-bootstrap-secret");
  if (!secret || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = adminDb();
    const log: string[] = [];

    const [childrenSnap, usersSnap] = await Promise.all([
      db.collection("children").where("schoolId", "==", SCHOOL_ID).get(),
      db.collection("users").where("schoolId", "==", SCHOOL_ID).get(),
    ]);

    const children = childrenSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const usersByEmail: Record<string, any> = {};
    const parentUsers: any[] = [];
    for (const d of usersSnap.docs) {
      const u = { uid: d.id, ...(d.data() as any) };
      if (u.email) usersByEmail[u.email] = u;
      if (u.role === "parent") parentUsers.push(u);
    }

    const tUid = (classId: string) =>
      usersByEmail[CLASS_TEACHERS[classId] ?? ""]?.uid ?? "unknown";

    // ── Attendance ───────────────────────────────────────────────────────────
    let batch = db.batch();
    let n = 0;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const absent = ABSENT_INDICES.has(i);
      const signedOut = SIGNED_OUT_INDICES.has(i);
      const classId: string = child.classId ?? "cls-walkers";
      const isBaby = classId === "cls-babies" || classId === "cls-toddlers";

      const checkInTime = absent ? undefined : ts(7 + Math.floor((i % 8) / 2), [0, 15, 30, 45][i % 4]);
      const checkOutTime = signedOut ? ts(14, [0, 15, 30, 45, 0][i % 5]) : undefined;
      const meals = absent ? [] : [
        { name: "Breakfast snack", eaten: rand(["all", "some", "all", "all"] as const) },
        { name: "Lunch",           eaten: rand(["all", "some", "all", "some", "none"] as const) },
        { name: "Afternoon snack", eaten: i < children.length * 0.7 ? rand(["all", "some"] as const) : "none" as const },
      ];
      const napMinutes = absent ? 0
        : isBaby ? rand([60, 90, 120, 75, 90, 45] as const)
        : classId === "cls-walkers" ? rand([0, 30, 45, 60] as const)
        : 0;

      const docId = `${TODAY_STR}_${child.id}`;
      batch.set(db.collection("daily_updates").doc(docId), {
        id: docId, schoolId: SCHOOL_ID, childId: child.id, classId,
        teacherId: tUid(classId), date: TODAY_STR,
        checkedIn: !absent, checkInTime, checkOutTime,
        mood: absent ? undefined : MOODS[i % MOODS.length],
        napMinutes, meals,
        activities: absent ? [] : (ACTIVITIES[classId] ?? []),
        notes: absent       ? "Parent called in — mild fever"
          : signedOut       ? "Early pickup — dentist appointment"
          : i % 9 === 0     ? "Big morning — went straight down for nap after lunch \u2764\uFE0F"
          : i % 11 === 0    ? "Ate really well today — tried the butternut soup!"
          : undefined,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      n++;
      if (n === 499) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n > 0) await batch.commit();
    log.push(`✓ ${children.length} attendance records (${ABSENT_INDICES.size} absent, ${SIGNED_OUT_INDICES.size} signed out)`);

    // ── Learning Journals ────────────────────────────────────────────────────
    const journals = [
      { classId: "cls-babies",    title: "Sensory Morning",
        obs: "The babies had a wonderful sensory morning. Soft-texture station with velvet, faux fur and crinkle fabric. Amara was particularly engaged, reaching for each piece with a big smile. Tummy time with gentle music followed — great for neck strengthening. Most settled easily after lunch." },
      { classId: "cls-toddlers",  title: "Playdough Builders",
        obs: "Playdough session was a hit! The toddlers rolled, squished and poked for nearly 40 minutes — exceptional concentration. Luca built a 'snake house' and we extended by counting the snakes together. Language development clearly visible as children narrated their creations." },
      { classId: "cls-walkers",   title: "Outdoor Explorers",
        obs: "The Walkers explored the veggie patch and talked about what plants need to grow. Leo found a snail and the group gathered round for a spontaneous science discussion. Zara named it Speedy. Followed by sand play where children practised pouring and measuring." },
      { classId: "cls-preschool", title: "Letter of the Week: S",
        obs: "Excellent engagement with letter S today. Children found items beginning with S around the classroom. We practised writing S in shaving foam — a firm favourite! Ethan helped his neighbour when they got stuck, showing wonderful empathy." },
      { classId: "cls-kinder",    title: "Volcano Science Experiment",
        obs: "The Kindergarten erupted with excitement during our vinegar and baking soda experiment. Each child made a prediction before we started. We discussed chemical reactions in age-appropriate terms. Four children completed their reader level assessment after lunch." },
    ];

    const jBatch = db.batch();
    for (const j of journals) {
      const tid = tUid(j.classId);
      const teacher = Object.values(usersByEmail).find((u: any) => u.uid === tid) as any;
      const classChild = children.find(c => c.classId === j.classId);
      const jId = `journal_${TODAY_STR}_${j.classId}`;
      jBatch.set(db.collection("journal_entries").doc(jId), {
        id: jId, schoolId: SCHOOL_ID, classId: j.classId,
        childId: classChild?.id ?? "",
        childName: classChild ? `${classChild.firstName} ${classChild.lastName}` : "",
        title: j.title, observation: j.obs,
        domains: ["cognitive", "social", "physical"],
        photoUrls: [], sharedWithParent: true,
        authorId: tid, authorName: teacher?.displayName ?? "Teacher",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await jBatch.commit();
    log.push(`✓ ${journals.length} learning journal entries`);

    // ── Invoices ─────────────────────────────────────────────────────────────
    const FEE = 350000;
    const iBatch = db.batch();
    let invoiceCount = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const parentId = child.parentIds?.[0] ?? parentUsers[i % Math.max(parentUsers.length, 1)]?.uid ?? "unknown";
      const childName = `${child.firstName} ${child.lastName}`;
      const lineItems = [
        { description: "Monthly tuition",  amountCents: 320000 },
        { description: "Consumables levy", amountCents: 20000 },
        { description: "Afternoon snack",  amountCents: 10000 },
      ];
      // Last month
      const lastStatus = i % 10 === 3 ? "overdue" : "paid";
      iBatch.set(db.collection("invoices").doc(`inv_${LAST_MONTH}_${child.id}`), {
        id: `inv_${LAST_MONTH}_${child.id}`, schoolId: SCHOOL_ID, branchId: SCHOOL_ID,
        parentId, childId: child.id, childName, month: LAST_MONTH,
        description: `Monthly tuition — ${new Date(LAST_MONTH + "-01").toLocaleString("en-ZA", { month: "long", year: "numeric" })}`,
        amountCents: FEE, status: lastStatus, dueDate: `${LAST_MONTH}-25`,
        paidAt: lastStatus === "paid" ? `${LAST_MONTH}-22` : undefined,
        lineItems, createdAt: FieldValue.serverTimestamp(),
      });
      // This month
      const thisStatus = i % 10 < 7 ? "paid" : "outstanding"; // ~70% paid
      iBatch.set(db.collection("invoices").doc(`inv_${THIS_MONTH}_${child.id}`), {
        id: `inv_${THIS_MONTH}_${child.id}`, schoolId: SCHOOL_ID, branchId: SCHOOL_ID,
        parentId, childId: child.id, childName, month: THIS_MONTH,
        description: `Monthly tuition — ${new Date(THIS_MONTH + "-01").toLocaleString("en-ZA", { month: "long", year: "numeric" })}`,
        amountCents: FEE, status: thisStatus, dueDate: `${THIS_MONTH}-25`,
        paidAt: thisStatus === "paid" ? TODAY_STR : undefined,
        lineItems, createdAt: FieldValue.serverTimestamp(),
      });
      invoiceCount += 2;
    }
    await iBatch.commit();
    log.push(`✓ ${invoiceCount} invoices (last month + this month)`);

    // ── Messages ─────────────────────────────────────────────────────────────
    const mBatch = db.batch();
    let msgCount = 0;
    const threads = [
      { tEmail: "teacher1@sunflower.demo", pIdx: 0, cIdx: 0, msgs: [
        { r: "parent",  text: "Hi! We will be a bit late picking up today around 5pm if that is okay?", t: "12:30" },
        { r: "teacher", text: "No problem! She had a lovely day — big smiles during sensory time", t: "12:45" },
        { r: "parent",  text: "That is so lovely to hear, thank you!", t: "12:47" },
      ]},
      { tEmail: "teacher3@sunflower.demo", pIdx: 1, cIdx: 10, msgs: [
        { r: "parent",  text: "Luca has a slight runny nose — nothing serious but wanted to give you a heads up.", t: "08:15" },
        { r: "teacher", text: "Thanks! He has been perfectly happy — currently building a playdough snake", t: "10:22" },
        { r: "parent",  text: "Can you send me a photo if you get a chance?", t: "10:45" },
        { r: "teacher", text: "Of course! Will snap one after lunch", t: "10:48" },
      ]},
      { tEmail: "teacher5@sunflower.demo", pIdx: 2, cIdx: 20, msgs: [
        { r: "parent",  text: "Does Leo need to bring anything for the spring show next week?", t: "13:05" },
        { r: "teacher", text: "Just a plain white T-shirt and comfortable shoes. More details in tomorrow newsletter!", t: "14:20" },
      ]},
      { tEmail: "teacher6@sunflower.demo", pIdx: 3, cIdx: 30, msgs: [
        { r: "parent",  text: "Ethan mentioned he had a small argument with a friend — is everything okay?", t: "15:01" },
        { r: "teacher", text: "All sorted! Quick disagreement over the sandpit but they made up straight away. He helped his friend with letter work later — really sweet.", t: "15:14" },
        { r: "parent",  text: "Oh what a relief! Thank you.", t: "15:20" },
      ]},
    ];
    for (const thread of threads) {
      const teacherUidVal = usersByEmail[thread.tEmail]?.uid;
      const parent = parentUsers[thread.pIdx];
      const child = children[thread.cIdx];
      if (!teacherUidVal || !parent || !child) continue;
      const threadId = `${teacherUidVal}_${parent.uid}_${child.id}`;
      for (const msg of thread.msgs) {
        const senderId = msg.r === "teacher" ? teacherUidVal : parent.uid;
        const mId = db.collection("messages").doc().id;
        mBatch.set(db.collection("messages").doc(mId), {
          id: mId, schoolId: SCHOOL_ID, childId: child.id, threadId,
          senderId, senderRole: msg.r,
          text: msg.text, createdAt: `${TODAY_STR}T${msg.t}:00.000Z`,
          read: msg.r === "parent",
        });
        msgCount++;
      }
    }
    await mBatch.commit();
    log.push(`✓ ${msgCount} messages across ${threads.length} threads`);

    // ── Incidents ────────────────────────────────────────────────────────────
    const incBatch = db.batch();
    if (children[5]) {
      incBatch.set(db.collection("incidents").doc(`inc_${TODAY_STR}_1`), {
        id: `inc_${TODAY_STR}_1`, schoolId: SCHOOL_ID, date: TODAY_STR,
        childId: children[5].id, childName: `${children[5].firstName} ${children[5].lastName}`,
        classId: "cls-walkers", teacherId: tUid("cls-walkers"),
        type: "injury", severity: "minor",
        description: "Child tripped on edge of sandpit at 10:15am and grazed left knee. Wound cleaned and plaster applied. Child returned to play within 5 minutes. No swelling.",
        actionTaken: "Antiseptic applied, plaster fitted. Parent notified via message.",
        parentNotified: true, parentNotifiedAt: `${TODAY_STR}T10:22:00.000Z`,
        time: `${TODAY_STR}T10:15:00.000Z`, createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (children[22]) {
      incBatch.set(db.collection("incidents").doc(`inc_${TODAY_STR}_2`), {
        id: `inc_${TODAY_STR}_2`, schoolId: SCHOOL_ID, date: TODAY_STR,
        childId: children[22].id, childName: `${children[22].firstName} ${children[22].lastName}`,
        classId: "cls-preschool", teacherId: tUid("cls-preschool"),
        type: "injury", severity: "minor",
        description: "During outdoor obstacle course at 09:45am, child bumped head on low beam. Small red mark on forehead, no swelling or loss of consciousness. Child alert throughout. Ice pack applied 10 minutes.",
        actionTaken: "Ice pack applied. Monitored 30 minutes. Parents called.",
        parentNotified: true, parentNotifiedAt: `${TODAY_STR}T09:52:00.000Z`,
        time: `${TODAY_STR}T09:45:00.000Z`, createdAt: FieldValue.serverTimestamp(),
      });
    }
    await incBatch.commit();
    log.push("✓ 2 incident reports");

    // ── Medical Records ──────────────────────────────────────────────────────
    const medBatch = db.batch();
    const medCases = [
      { idx: 1,  conditions: [{ name: "Asthma", notes: "Exercise-induced. Ventolin in staff first aid kit." }],
        medications: [{ name: "Ventolin", dose: "2 puffs", frequency: "Before outdoor play / as needed", prescribedBy: "Dr. Patel", instructions: "Stored in first aid cabinet" }],
        allergies: [], dietary: { vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, dairyFree: false } },
      { idx: 6,  conditions: [], medications: [],
        allergies: [{ name: "Peanuts", severity: "anaphylactic", reaction: "Anaphylaxis", treatment: "Administer EpiPen immediately, call 112" }],
        dietary: { vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, dairyFree: false } },
      { idx: 14, conditions: [{ name: "Lactose intolerance", notes: "Oat milk provided by school." }], medications: [], allergies: [],
        dietary: { vegetarian: false, vegan: false, halal: false, kosher: false, glutenFree: false, dairyFree: true } },
      { idx: 31, conditions: [], medications: [], allergies: [],
        dietary: { vegetarian: false, vegan: false, halal: true, kosher: false, glutenFree: false, dairyFree: false } },
    ];
    for (const m of medCases) {
      const child = children[m.idx];
      if (!child) continue;
      medBatch.set(db.collection("medical_records").doc(child.id), {
        id: child.id, childId: child.id, schoolId: SCHOOL_ID,
        bloodType: rand(["A+", "O+", "B+", "AB+", "O-"] as const),
        allergies: m.allergies, medications: m.medications, conditions: m.conditions,
        dietary: m.dietary,
        doctorName: rand(["Dr. Naidoo", "Dr. Patel", "Dr. van der Merwe", "Dr. Mokoena"] as const),
        doctorPhone: "+27 11 555 0199",
        emergencyContacts: [{ name: "Grandmother", relationship: "Maternal grandmother", phone: "+27 82 555 0111", canPickup: true }],
        notes: "", createdAt: "2025-01-15T08:00:00.000Z", updatedAt: TODAY_STR,
      }, { merge: true });
    }
    await medBatch.commit();
    log.push(`✓ ${medCases.length} medical records`);

    // ── Waiting List ─────────────────────────────────────────────────────────
    const wBatch = db.batch();
    const waitlist = [
      { first: "Zinhle", last: "Dube",  dob: "2025-01-10", parent: "Nomvulo Dube",  email: "nomvulo.dube@email.com",  phone: "+27 82 111 2233", notes: "Looking for January 2026 start", start: "2026-01-12" },
      { first: "Ryan",   last: "Smith", dob: "2024-08-22", parent: "Karen Smith",   email: "karen.smith@email.com",   phone: "+27 71 444 5566", notes: "Twins — brother James also interested", start: "2026-02-01" },
      { first: "Aisha",  last: "Khan",  dob: "2024-11-05", parent: "Faizal Khan",   email: "faizal.khan@email.com",   phone: "+27 83 777 8899", notes: "Halaal meals required", start: "2026-01-19" },
      { first: "Pieter", last: "Nel",   dob: "2025-03-14", parent: "Elmien Nel",    email: "elmien.nel@email.com",    phone: "+27 72 333 4455", notes: "Referred by Priya Naidoo", start: "2026-01-12" },
    ];
    for (let i = 0; i < waitlist.length; i++) {
      const e = waitlist[i];
      wBatch.set(db.collection("waitlist").doc(`wl_${i + 1}`), {
        id: `wl_${i + 1}`, schoolId: SCHOOL_ID,
        childFirstName: e.first, childLastName: e.last, childDateOfBirth: e.dob,
        parentName: e.parent, parentEmail: e.email, parentPhone: e.phone,
        desiredStartDate: e.start, notes: e.notes, position: i + 1, status: "waiting",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await wBatch.commit();
    log.push(`✓ ${waitlist.length} waiting list entries`);

    // ── Admissions ───────────────────────────────────────────────────────────
    const aBatch = db.batch();
    const owner1Uid = usersByEmail["owner1@sunflower.demo"]?.uid ?? "";
    aBatch.set(db.collection("admissions").doc("adm_001"), {
      id: "adm_001", schoolId: SCHOOL_ID,
      childFirstName: "Cleo", childLastName: "Jacobs", childDateOfBirth: "2023-09-18",
      parentName: "Tara Jacobs", parentEmail: "tara.jacobs@email.com", parentPhone: "+27 83 100 2200",
      desiredStartDate: "2026-07-07",
      notes: "Our daughter has been in a home-based programme and we are looking for more structured learning.",
      status: "reviewing", reviewedBy: owner1Uid, reviewedAt: TODAY_STR,
      internalNotes: "Strong candidate. Walkers class has 1 space. Follow up on immunisation records.",
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    aBatch.set(db.collection("admissions").doc("adm_002"), {
      id: "adm_002", schoolId: SCHOOL_ID,
      childFirstName: "Kwame", childLastName: "Asante", childDateOfBirth: "2022-04-30",
      parentName: "Abena Asante", parentEmail: "abena.asante@email.com", parentPhone: "+27 71 900 1122",
      desiredStartDate: "2026-08-03", notes: "Moving from Cape Town. Child currently at Pre-School level.",
      status: "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await aBatch.commit();
    log.push("✓ 2 admissions in pipeline (1 reviewing, 1 pending)");

    // ── HR Profiles + Leave Request ─────────────────────────────────────────
    const hBatch = db.batch();
    const teachers = (Object.values(usersByEmail) as any[]).filter(u => u.role === "teacher");
    const banks = ["FNB", "Standard Bank", "ABSA", "Capitec"] as const;
    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      hBatch.set(db.collection("hr_profiles").doc(t.uid), {
        id: t.uid, uid: t.uid, schoolId: SCHOOL_ID,
        employeeId: `EMP-00${i + 1}`,
        contractType: i < 6 ? "permanent" : "part-time",
        startDate: "2024-01-15",
        salary: i < 6 ? 1800000 : 900000,
        leaveBalance: { annual: 15 - (i % 5), sick: 30 - (i * 2) },
        qualifications: ["ECD Level 4", i % 2 === 0 ? "First Aid Level 1" : "Baby & Toddler CPR"],
        emergencyContact: { name: "Family member", phone: `+27 82 000 000${i}`, relationship: "Spouse" },
        bankAccount: { bank: rand(banks), accountNumber: `620000000${i + 1}`, branchCode: "250655" },
        createdAt: "2024-01-15T08:00:00.000Z", updatedAt: TODAY_STR,
      }, { merge: true });
    }
    if (teachers[2]) {
      hBatch.set(db.collection("leave_requests").doc("lr_001"), {
        id: "lr_001", schoolId: SCHOOL_ID,
        staffUid: teachers[2].uid, staffName: teachers[2].displayName,
        leaveType: "annual", startDate: "2026-07-14", endDate: "2026-07-18", days: 5,
        reason: "Family holiday — booked in advance", status: "pending",
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await hBatch.commit();
    log.push(`✓ ${teachers.length} HR profiles + 1 pending leave request`);

    return NextResponse.json({ success: true, date: TODAY_STR, log });
  } catch (err: any) {
    console.error("[seed/daily]", err);
    return NextResponse.json({ error: err.message ?? "Seed failed" }, { status: 500 });
  }
}
