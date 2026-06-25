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
  avatarUrl?: string;
  createdAt: string;
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

// ─── Admissions ───────────────────────────────────────────────────────────────
export type AdmissionStatus =
  | "pending"    // just submitted, awaiting owner review
  | "reviewing"  // owner opened it
  | "approved"   // owner approved — child record created, parent invited
  | "declined"   // owner declined
  | "enrolled";  // parent completed setup, child active

export interface Admission {
  id: string;
  schoolId: string;
  // Child info
  childFirstName: string;
  childLastName: string;
  childDateOfBirth: string;         // YYYY-MM-DD
  // Primary guardian
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  // Optional
  notes?: string;                   // from applicant
  internalNotes?: string;           // from owner
  desiredStartDate?: string;        // YYYY-MM-DD
  // Admin
  status: AdmissionStatus;
  reviewedBy?: string;              // uid of owner who actioned
  reviewedAt?: string;
  childId?: string;                 // set on approval
  createdAt: string;
  updatedAt: string;
}

// ─── Medical Records ──────────────────────────────────────────────────────────

export type AllergySeverity = "mild" | "moderate" | "severe" | "anaphylactic";

export interface Allergy {
  name: string;                    // e.g. "Peanuts", "Bee stings"
  severity: AllergySeverity;
  reaction?: string;               // e.g. "Hives, swelling"
  treatment?: string;              // e.g. "Administer EpiPen, call ambulance"
}

export interface Medication {
  name: string;                    // e.g. "Ventolin"
  dose: string;                    // e.g. "2 puffs"
  frequency: string;               // e.g. "As needed for asthma"
  instructions?: string;           // e.g. "Keep in child's bag at all times"
  prescribedBy?: string;           // Doctor name
}

export interface EmergencyContact {
  name: string;
  relationship: string;            // e.g. "Grandmother", "Uncle"
  phone: string;
  canPickup: boolean;
}

export interface MedicalCondition {
  name: string;                    // e.g. "Asthma", "Epilepsy", "ADHD"
  notes?: string;
}

export interface MedicalRecord {
  id: string;                      // == childId
  childId: string;
  schoolId: string;
  // General
  bloodType?: string;              // "A+", "O-", etc.
  // Allergies
  allergies: Allergy[];
  // Medications to administer at school
  medications: Medication[];
  // Medical conditions staff should know
  conditions: MedicalCondition[];
  // Dietary requirements
  dietary: {
    vegetarian: boolean;
    vegan: boolean;
    halal: boolean;
    kosher: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
    other?: string;
  };
  // Primary doctor
  doctorName?: string;
  doctorPractice?: string;
  doctorPhone?: string;
  // Medical aid / insurance
  medicalAidProvider?: string;
  medicalAidNumber?: string;
  medicalAidDependantCode?: string;
  // Additional notes
  notes?: string;
  // Emergency contacts (beyond parents already in the system)
  emergencyContacts: EmergencyContact[];
  // Audit
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy?: string;          // uid of staff who last edited
}


// ─── Learning Journals ────────────────────────────────────────────────────────

export type DevelopmentDomain =
  | "physical"      // gross/fine motor
  | "cognitive"     // problem solving, memory
  | "language"      // communication, literacy
  | "social"        // peer interaction, sharing
  | "emotional"     // self-regulation, confidence
  | "creative";     // art, music, imaginative play

export interface JournalEntry {
  id: string;
  schoolId: string;
  childId: string;
  childName: string;           // denormalised for queries without joins
  // Content
  title: string;
  observation: string;         // what the teacher observed
  domains: DevelopmentDomain[];
  photoUrls: string[];
  // Visibility
  sharedWithParent: boolean;   // false = draft/internal only
  // Audit
  authorId: string;            // teacher uid
  authorName: string;
  createdAt: string;
  updatedAt: string;
}
