import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AppUser, School, Child, ClassRoom, DailyUpdate,
  Moment, Invoice, Task, Message, CockpitStats,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDate(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date().toISOString();
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...d, uid: snap.id, createdAt: toDate(d.createdAt) } as AppUser;
}

export async function createUser(uid: string, data: Omit<AppUser, "uid" | "createdAt">): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}

// ─── Schools ─────────────────────────────────────────────────────────────────
export async function getSchool(schoolId: string): Promise<School | null> {
  const snap = await getDoc(doc(db, "schools", schoolId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...d, id: snap.id, createdAt: toDate(d.createdAt) } as School;
}

export async function getSchoolBySlug(slug: string): Promise<School | null> {
  const q = query(collection(db, "schools"), where("slug", "==", slug), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { ...d, id: snap.docs[0].id, createdAt: toDate(d.createdAt) } as School;
}

export async function getAllSchools(): Promise<School[]> {
  const snap = await getDocs(collection(db, "schools"));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as School));
}

export async function createSchool(data: Omit<School, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "schools"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Children ────────────────────────────────────────────────────────────────
export async function getChildrenForClass(schoolId: string, classId: string): Promise<Child[]> {
  const q = query(
    collection(db, "children"),
    where("schoolId", "==", schoolId),
    where("classId", "==", classId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enrolledAt: toDate(d.data().enrolledAt) } as Child));
}

export async function getChildrenForParent(parentId: string): Promise<Child[]> {
  const q = query(collection(db, "children"), where("parentIds", "array-contains", parentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enrolledAt: toDate(d.data().enrolledAt) } as Child));
}

export async function getChildrenForSchool(schoolId: string): Promise<Child[]> {
  const q = query(collection(db, "children"), where("schoolId", "==", schoolId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, enrolledAt: toDate(d.data().enrolledAt) } as Child));
}

export async function addChild(data: Omit<Child, "id" | "enrolledAt">): Promise<string> {
  const ref = await addDoc(collection(db, "children"), {
    ...data,
    enrolledAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Classes ─────────────────────────────────────────────────────────────────
export async function getClassesForSchool(schoolId: string): Promise<ClassRoom[]> {
  const q = query(collection(db, "classes"), where("schoolId", "==", schoolId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClassRoom));
}

export async function getClassesForTeacher(teacherId: string): Promise<ClassRoom[]> {
  const q = query(collection(db, "classes"), where("teacherIds", "array-contains", teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as ClassRoom));
}

// ─── Daily Updates ────────────────────────────────────────────────────────────
export async function getDailyUpdateForChild(childId: string, date: string): Promise<DailyUpdate | null> {
  const q = query(
    collection(db, "daily_updates"),
    where("childId", "==", childId),
    where("date", "==", date),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return {
    ...d,
    id: snap.docs[0].id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } as DailyUpdate;
}

export async function upsertDailyUpdate(data: Omit<DailyUpdate, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  if (data.id) {
    await updateDoc(doc(db, "daily_updates", data.id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return data.id;
  }
  const ref = await addDoc(collection(db, "daily_updates"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getDailyUpdatesForClass(schoolId: string, classId: string, date: string): Promise<DailyUpdate[]> {
  const q = query(
    collection(db, "daily_updates"),
    where("schoolId", "==", schoolId),
    where("classId", "==", classId),
    where("date", "==", date)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  } as DailyUpdate));
}

// ─── Moments ─────────────────────────────────────────────────────────────────
export async function getMomentsForChild(childId: string, count = 20): Promise<Moment[]> {
  const q = query(
    collection(db, "moments"),
    where("childId", "==", childId),
    where("visibleToParents", "==", true),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Moment));
}

export async function addMoment(data: Omit<Moment, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "moments"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Invoices ────────────────────────────────────────────────────────────────
export async function getInvoicesForParent(parentId: string): Promise<Invoice[]> {
  const q = query(
    collection(db, "invoices"),
    where("parentId", "==", parentId),
    orderBy("createdAt", "desc"),
    limit(12)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Invoice));
}

export async function getInvoicesForSchool(schoolId: string): Promise<Invoice[]> {
  const q = query(
    collection(db, "invoices"),
    where("schoolId", "==", schoolId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Invoice));
}

export async function updateInvoiceStatus(invoiceId: string, status: Invoice["status"], proofUrl?: string): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (proofUrl) update.proofUrl = proofUrl;
  if (status === "paid") update.paidAt = serverTimestamp();
  await updateDoc(doc(db, "invoices", invoiceId), update);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasksForClass(schoolId: string, classId: string): Promise<Task[]> {
  const q = query(
    collection(db, "tasks"),
    where("schoolId", "==", schoolId),
    where("classId", "==", classId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id, createdAt: toDate(d.data().createdAt) } as Task));
}

export async function toggleTask(taskId: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, "tasks", taskId), { done });
}

export async function addTask(data: Omit<Task, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "tasks"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Messages ────────────────────────────────────────────────────────────────
export function subscribeToThread(
  threadId: string,
  callback: (messages: Message[]) => void
) {
  const q = query(
    collection(db, "messages"),
    where("threadId", "==", threadId),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const msgs = snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      createdAt: toDate(d.data().createdAt),
    } as Message));
    callback(msgs);
  });
}

export async function sendMessage(data: Omit<Message, "id" | "createdAt">): Promise<void> {
  await addDoc(collection(db, "messages"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ─── Cockpit Stats ────────────────────────────────────────────────────────────
export async function getCockpitStats(schoolId: string): Promise<CockpitStats> {
  const today = new Date().toISOString().split("T")[0];

  const [children, invoices, updates, staffSnap] = await Promise.all([
    getChildrenForSchool(schoolId),
    getInvoicesForSchool(schoolId),
    getDocs(query(
      collection(db, "daily_updates"),
      where("schoolId", "==", schoolId),
      where("date", "==", today)
    )),
    getDocs(query(
      collection(db, "users"),
      where("schoolId", "==", schoolId),
      where("role", "==", "teacher")
    )),
  ]);

  const checkedInToday = updates.docs.filter(d => d.data().checkedIn).length;

  const classes = await getClassesForSchool(schoolId);
  const totalCapacity = classes.reduce((sum, c) => sum + c.capacity, 0);

  const currentMonth = today.slice(0, 7);
  const monthInvoices = invoices.filter(i => i.month === currentMonth);
  const collectedMTD = monthInvoices
    .filter(i => i.status === "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);
  const outstandingMTD = monthInvoices
    .filter(i => i.status === "outstanding" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amountCents, 0);
  const outstandingFamilies = new Set(
    monthInvoices
      .filter(i => i.status === "outstanding" || i.status === "overdue")
      .map(i => i.parentId)
  ).size;

  const consentSnap = await getDocs(query(
    collection(db, "children"),
    where("schoolId", "==", schoolId),
    where("photoConsent", "==", false)
  ));

  return {
    totalChildren: children.length,
    checkedInToday,
    totalCapacity,
    collectedMTD,
    outstandingMTD,
    outstandingFamilies,
    staffCount: staffSnap.size,
    photoConsentPending: consentSnap.size,
  };
}
