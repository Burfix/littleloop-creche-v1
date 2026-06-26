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
  startAfter,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AppUser, School, Child, ClassRoom, DailyUpdate,
  Moment, Invoice, Task, Message, CockpitStats,
} from "./types";

export interface PaginationOptions {
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  includePendingErasure?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDate(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date().toISOString();
}

function normalizePageSize(pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
}

function withCursor(
  constraints: QueryConstraint[],
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): QueryConstraint[] {
  return cursor ? [...constraints, startAfter(cursor)] : constraints;
}

function toChild(snap: QueryDocumentSnapshot<DocumentData>): Child {
  const d = snap.data();
  return { ...d, id: snap.id, enrolledAt: toDate(d.enrolledAt) } as Child;
}

function isActiveChild(child: Child): boolean {
  return child.deletionStatus !== "pending_erasure";
}

function toDailyUpdate(snap: QueryDocumentSnapshot<DocumentData>): DailyUpdate {
  const d = snap.data();
  return {
    ...d,
    id: snap.id,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
  } as DailyUpdate;
}

function toInvoice(snap: QueryDocumentSnapshot<DocumentData>): Invoice {
  const d = snap.data();
  return { ...d, id: snap.id, createdAt: toDate(d.createdAt) } as Invoice;
}

function pageFromSnapshot<T>(
  docs: QueryDocumentSnapshot<DocumentData>[],
  pageSize: number,
  mapper: (snap: QueryDocumentSnapshot<DocumentData>) => T
): PaginatedResult<T> {
  const visibleDocs = docs.slice(0, pageSize);

  return {
    items: visibleDocs.map(mapper),
    nextCursor: visibleDocs.at(-1) ?? null,
    hasMore: docs.length > pageSize,
  };
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

export async function getAllUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ ...d.data(), uid: d.id, createdAt: toDate(d.data().createdAt) } as AppUser));
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
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id, enrolledAt: toDate(d.data().enrolledAt) } as Child))
    .filter(isActiveChild);
}

export async function getChildrenForParent(parentId: string): Promise<Child[]> {
  const q = query(collection(db, "children"), where("parentIds", "array-contains", parentId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id, enrolledAt: toDate(d.data().enrolledAt) } as Child))
    .filter(isActiveChild);
}

export async function getChildrenForSchool(schoolId: string): Promise<Child[]> {
  const children: Child[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasMore = true;

  while (hasMore) {
    const page = await getChildrenForSchoolPage(schoolId, {
      pageSize: MAX_PAGE_SIZE,
      cursor,
    });
    children.push(...page.items);
    cursor = page.nextCursor;
    hasMore = page.hasMore && Boolean(cursor);
  }

  return children;
}

export async function getChildrenForSchoolPage(
  schoolId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Child>> {
  const pageSize = normalizePageSize(options.pageSize);
  const constraints = [
    where("schoolId", "==", schoolId),
    orderBy("enrolledAt", "desc"),
  ];

  if (options.includePendingErasure) {
    const q = query(
      collection(db, "children"),
      ...withCursor([...constraints, limit(pageSize + 1)], options.cursor)
    );
    const snap = await getDocs(q);
    return pageFromSnapshot(snap.docs, pageSize, toChild);
  }

  let cursor = options.cursor ?? null;
  let nextCursor: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasMore = false;
  const items: Child[] = [];

  while (items.length < pageSize) {
    const q = query(
      collection(db, "children"),
      ...withCursor([...constraints, limit(pageSize + 1)], cursor)
    );
    const snap = await getDocs(q);
    const docs = snap.docs;
    const pageDocs = docs.slice(0, pageSize);
    let scannedAllPageDocs = true;

    for (const docSnap of pageDocs) {
      nextCursor = docSnap;
      const child = toChild(docSnap);
      if (isActiveChild(child)) {
        items.push(child);
        if (items.length === pageSize) {
          scannedAllPageDocs = docSnap === pageDocs.at(-1);
          break;
        }
      }
    }

    hasMore = docs.length > pageSize || !scannedAllPageDocs;
    cursor = nextCursor;

    if (!hasMore || pageDocs.length === 0) break;
  }

  return { items, nextCursor, hasMore };
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

export async function getClassRoom(classId: string): Promise<ClassRoom | null> {
  const snap = await getDoc(doc(db, "classes", classId));
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id } as ClassRoom;
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
  const page = await getDailyUpdatesForClassPage(schoolId, classId, date, { pageSize: MAX_PAGE_SIZE });
  return page.items;
}

export async function getDailyUpdatesForClassPage(
  schoolId: string,
  classId: string,
  date: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<DailyUpdate>> {
  const pageSize = normalizePageSize(options.pageSize);
  const q = query(
    collection(db, "daily_updates"),
    ...withCursor([
      where("schoolId", "==", schoolId),
      where("classId", "==", classId),
      where("date", "==", date),
      orderBy("childId", "asc"),
      limit(pageSize + 1),
    ], options.cursor)
  );
  const snap = await getDocs(q);
  return pageFromSnapshot(snap.docs, pageSize, toDailyUpdate);
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
  const page = await getInvoicesForSchoolPage(schoolId);
  return page.items;
}

export async function getInvoicesForSchoolPage(
  schoolId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Invoice>> {
  const pageSize = normalizePageSize(options.pageSize);
  const q = query(
    collection(db, "invoices"),
    ...withCursor([
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc"),
      limit(pageSize + 1),
    ], options.cursor)
  );
  const snap = await getDocs(q);
  return pageFromSnapshot(snap.docs, pageSize, toInvoice);
}

export async function updateInvoiceStatus(invoiceId: string, status: Invoice["status"], proofUrl?: string): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (proofUrl) update.proofUrl = proofUrl;
  if (status === "paid") update.paidAt = serverTimestamp();
  await updateDoc(doc(db, "invoices", invoiceId), update);
}

export async function updateInvoiceProof(invoiceId: string, proofUrl: string): Promise<void> {
  await updateDoc(doc(db, "invoices", invoiceId), { proofUrl });
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
  const threadChildId = data.threadId.split("_").at(-1);
  await addDoc(collection(db, "messages"), {
    ...data,
    childId: data.childId ?? threadChildId,
    createdAt: serverTimestamp(),
  });
}

// ─── Cockpit Stats ────────────────────────────────────────────────────────────
export async function getCockpitStats(schoolId: string): Promise<CockpitStats> {
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.slice(0, 7);

  const [
    checkedInCountSnap,
    staffCountSnap,
    monthInvoicesSnap,
    childPage,
  ] = await Promise.all([
    getCountFromServer(query(
      collection(db, "daily_updates"),
      where("schoolId", "==", schoolId),
      where("date", "==", today),
      where("checkedIn", "==", true)
    )),
    getCountFromServer(query(
      collection(db, "users"),
      where("schoolId", "==", schoolId),
      where("role", "==", "teacher")
    )),
    getDocs(query(
      collection(db, "invoices"),
      where("schoolId", "==", schoolId),
      where("month", "==", currentMonth)
    )),
    getChildrenForSchool(schoolId),
  ]);

  const classes = await getClassesForSchool(schoolId);
  const totalCapacity = classes.reduce((sum, c) => sum + c.capacity, 0);

  const monthInvoices = monthInvoicesSnap.docs.map(toInvoice);
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

  return {
    totalChildren: childPage.length,
    checkedInToday: checkedInCountSnap.data().count,
    totalCapacity,
    collectedMTD,
    outstandingMTD,
    outstandingFamilies,
    staffCount: staffCountSnap.data().count,
    photoConsentPending: childPage.filter(child => !child.photoConsent).length,
  };
}
