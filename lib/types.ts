// ─── Tenant / School ────────────────────────────────────────────────────────
export interface School {
  id: string;
  name: string;
  slug: string; // used for subdomain routing: pebblestones.littleloop.app
  logoUrl?: string;
  primaryColor?: string; // hex, for white-labelling
  address?: string;
  phone?: string;
  email?: string;
  branches: Branch[];
  plan: "starter" | "growth" | "enterprise";
  createdAt: string;
}

export interface Branch {
  id: string;
  schoolId: string;
  name: string; // e.g. "Milnerton", "Tableview"
  address?: string;
}

// ─── Users / Roles ───────────────────────────────────────────────────────────
export type UserRole = "parent" | "teacher" | "owner" | "superadmin";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  schoolId: string | null; // null for superadmin
  branchId?: string;       // for teachers
  childIds?: string[];     // for parents
  phone?: string;
  avatarUrl?: string;
  fcmToken?: string;
  createdAt: string;
  hasSeenOnboardingWelcome?: boolean; // owners only — gates the one-time /onboarding landing
}

// ─── Children ────────────────────────────────────────────────────────────────
export interface Child {
  id: string;
  schoolId: string;
  branchId: string;
  classId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  avatarUrl?: string;
  parentIds: string[];
  allergies?: string;
  notes?: string;
  photoConsent: boolean;
  enrolledAt: string;
  deletionStatus?: "pending_erasure";
  deletionRequestedAt?: string;
  deletionRequestedBy?: string;
}

// ─── Classes ─────────────────────────────────────────────────────────────────
export interface ClassRoom {
  id: string;
  schoolId: string;
  branchId: string;
  name: string; // e.g. "Toddlers 1-2yr"
  ageGroupMin: number;
  ageGroupMax: number;
  capacity: number;
  teacherIds: string[];
}

// ─── Daily Updates ────────────────────────────────────────────────────────────
export type MoodEmoji = "😊" | "😐" | "😢" | "😴" | "🤒";

export interface DailyUpdate {
  id: string;
  schoolId: string;
  childId: string;
  classId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  checkedIn: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  mood?: MoodEmoji;
  napMinutes?: number;
  meals: MealRecord[];
  notes?: string;
  activities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MealRecord {
  name: string; // e.g. "Breakfast", "Lunch", "Snack"
  eaten: "all" | "some" | "none";
}

// ─── Moments (Photos/Videos) ─────────────────────────────────────────────────
export interface Moment {
  id: string;
  schoolId: string;
  childId: string;
  classId: string;
  teacherId: string;
  date: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  type: "photo" | "video";
  visibleToParents: boolean;
  createdAt: string;
}

// ─── Billing ─────────────────────────────────────────────────────────────────
export type InvoiceStatus = "paid" | "outstanding" | "overdue" | "draft";

export interface Invoice {
  id: string;
  schoolId: string;
  branchId: string;
  parentId: string;
  childId: string;
  month: string; // "2026-05"
  amountCents: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  proofUrl?: string;
  lineItems: LineItem[];
  createdAt: string;
}

export interface LineItem {
  description: string;
  amountCents: number;
}

// ─── Teacher Tasks ────────────────────────────────────────────────────────────
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  schoolId: string;
  branchId: string;
  classId?: string;
  assignedTo?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  done: boolean;
  dueDate?: string;
  createdAt: string;
}

// ─── Messages / Chat ─────────────────────────────────────────────────────────
export interface Message {
  id: string;
  schoolId: string;
  childId?: string;
  threadId: string; // `${teacherId}_${parentId}_${childId}`
  senderId: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
  read: boolean;
}

// ─── Owner Cockpit Stats ──────────────────────────────────────────────────────
export interface CockpitStats {
  totalChildren: number;
  checkedInToday: number;
  totalCapacity: number;
  collectedMTD: number;  // cents
  outstandingMTD: number; // cents
  outstandingFamilies: number;
  staffCount: number;
  photoConsentPending: number;
}

// ─── School Launch ("School Launch Package" paid onboarding) ─────────────────
// See lib/school-launch.ts for the module that builds/derives these. Unlike
// the original lib/onboarding.ts model (fully derived from data presence),
// several fields here (specialist, payment, sessions, target date) cannot be
// derived from anything the school does — they're set by the LittleLoop
// implementation team. That data lives in a SchoolLaunchRecord, one per
// school, stored separately from the school doc itself.

export type LaunchStageKey =
  | "welcome"
  | "schoolProfile"
  | "childrenImport"
  | "classes"
  | "teachers"
  | "parents"
  | "billingConfiguration"
  | "teamTraining"
  | "launchReadiness"
  | "goLive";

export type LaunchResponsibility = "school" | "littleloop" | "shared";

export type LaunchTaskStatus =
  | "not_started"
  | "waiting_for_school"
  | "submitted"
  | "under_review"
  | "needs_changes"
  | "scheduled"
  | "completed"
  | "blocked"
  | "not_applicable";

export type LaunchTaskActionType =
  | "manual_form"   // links to an existing manual creation flow
  | "upload"        // CSV/spreadsheet import
  | "external_link" // e.g. join a call, view a shared doc
  | "confirmation"  // simple "mark done" acknowledgement
  | "none";         // informational only — no owner action available

export interface SchoolLaunchTask {
  id: string;
  key: string; // stable within a stage, e.g. "uploadEnrolmentList"
  title: string;
  description?: string;
  stage: LaunchStageKey;
  status: LaunchTaskStatus;
  responsibility: LaunchResponsibility;
  required: boolean; // required for launch vs. recommended after
  completedAt?: string;
  completedBy?: string; // uid
  dueDate?: string;
  blockingReason?: string;
  actionType: LaunchTaskActionType;
  actionHref?: string;
  notes?: string;
  sortOrder: number;
}

export interface SchoolLaunchStage {
  key: LaunchStageKey;
  title: string;
  description: string;
  sortOrder: number;
  tasks: SchoolLaunchTask[];
}

export type OnboardingPaymentStatus = "unpaid" | "invoiced" | "paid" | "waived";

export interface SchoolLaunchPayment {
  status: OnboardingPaymentStatus;
  packageName: string; // customer-facing: "School Launch Package"
  amountCents: number;
  paidAt?: string;
  invoiceReference?: string;
  paymentReference?: string;
}

export interface ImplementationSpecialist {
  id: string;
  name: string;
  role: string; // e.g. "Implementation Specialist"
  initials: string;
  avatarUrl?: string;
  email?: string;
  phone?: string; // for WhatsApp/call actions
  supportHours?: string;
}

export type LaunchSessionType =
  | "school_setup_call"
  | "data_review"
  | "teacher_training"
  | "billing_review"
  | "go_live_check";

export type LaunchSessionStatus =
  | "not_scheduled"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rescheduled";

export interface LaunchSession {
  id: string;
  type: LaunchSessionType;
  title: string;
  status: LaunchSessionStatus;
  scheduledAt?: string; // ISO datetime
  durationMinutes?: number;
  meetingLink?: string;
  participants?: string[]; // display names or emails
  notes?: string;
}

/**
 * Manual status override for a task with no derivable signal (e.g. team
 * training completion, final readiness confirmation, go-live). Keyed by
 * task key on SchoolLaunchRecord.taskOverrides. Set by LittleLoop staff —
 * see lib/school-launch.ts normalization for how this combines with
 * derived signals.
 */
export interface LaunchTaskOverride {
  status: LaunchTaskStatus;
  completedAt?: string;
  completedBy?: string;
  blockingReason?: string;
  notes?: string;
}

/**
 * Stored once per school (doc id == schoolId, collection "schoolLaunches").
 * Holds everything about a school's launch that cannot be computed from
 * existing data — set by the LittleLoop team, read-only for owners. Absent
 * for any school that predates this feature; lib/school-launch.ts
 * normalizes that to safe defaults rather than treating it as an error.
 */
export interface SchoolLaunchRecord {
  schoolId: string;
  targetGoLiveDate?: string; // ISO date
  specialist?: ImplementationSpecialist;
  payment: SchoolLaunchPayment;
  sessions: LaunchSession[];
  taskOverrides: Record<string, LaunchTaskOverride>;
  launchedAt?: string; // set when the Go live task is marked complete
  createdAt: string;
  updatedAt: string;
}

/**
 * Computed, not stored — see computeSchoolLaunchStatus in
 * lib/school-launch.ts. progressPct/isComplete/currentStage/blockers are
 * deliberately derived on every read so they can never drift from the
 * underlying tasks.
 */
export interface SchoolLaunchStatus {
  stages: SchoolLaunchStage[];
  completedRequiredCount: number;
  totalRequiredCount: number;
  progressPct: number; // 0-100
  isComplete: boolean;
  currentStage: SchoolLaunchStage | null;
  blockers: SchoolLaunchTask[];
  targetGoLiveDate?: string;
  specialist?: ImplementationSpecialist;
  payment: SchoolLaunchPayment;
  nextSession?: LaunchSession;
}
