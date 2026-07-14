import { describe, expect, it } from "vitest";
import {
  computeSchoolLaunchStatus,
  getLaunchReadiness,
  normalizeSchoolLaunchRecord,
  type ComputeStatusInput,
  type DerivedCounts,
} from "./school-launch";
import type { School, SchoolLaunchRecord } from "./types";

// These tests exercise only the pure functions (computeSchoolLaunchStatus,
// getLaunchReadiness, normalizeSchoolLaunchRecord) — no Firestore calls, no
// mocking needed. getSchoolLaunchRecord/getSchoolLaunchStatus (the async
// wrappers) are intentionally thin and untested here; they're exercised by
// hand against the emulator/preview the same way the rest of this codebase
// verifies Firestore-touching code.

const ZERO_COUNTS: DerivedCounts = {
  childCount: 0,
  classCount: 0,
  teacherCount: 0,
  parentCount: 0,
  invoiceCount: 0,
};

const FULL_COUNTS: DerivedCounts = {
  childCount: 12,
  classCount: 2,
  teacherCount: 3,
  parentCount: 10,
  invoiceCount: 5,
};

function makeSchool(overrides: Partial<School> = {}): School {
  return {
    id: "school-1",
    name: "Sunflower House",
    slug: "sunflower-house",
    branches: [],
    plan: "starter",
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function makeInput(overrides: Partial<ComputeStatusInput> = {}): ComputeStatusInput {
  return {
    school: null,
    hasSeenWelcome: false,
    counts: ZERO_COUNTS,
    record: normalizeSchoolLaunchRecord("school-1", null),
    uploads: {},
    ...overrides,
  };
}

describe("normalizeSchoolLaunchRecord", () => {
  it("produces safe defaults for a school with no schoolLaunches doc at all (every existing school today)", () => {
    const record = normalizeSchoolLaunchRecord("school-1", null);
    expect(record.schoolId).toBe("school-1");
    expect(record.payment.status).toBe("unpaid");
    expect(record.payment.packageName).toBe("School Launch Package");
    expect(record.sessions).toEqual([]);
    expect(record.taskOverrides).toEqual({});
    expect(record.specialist).toBeUndefined();
    expect(record.launchedAt).toBeUndefined();
  });

  it("preserves stored fields when present and only fills in gaps", () => {
    const record = normalizeSchoolLaunchRecord("school-1", {
      targetGoLiveDate: "2026-07-28",
      payment: { status: "paid", packageName: "School Launch Package", amountCents: 500000 },
    });
    expect(record.targetGoLiveDate).toBe("2026-07-28");
    expect(record.payment.status).toBe("paid");
    // sessions/taskOverrides still default even though other fields were provided
    expect(record.sessions).toEqual([]);
    expect(record.taskOverrides).toEqual({});
  });

  it("defends against a non-array sessions field (corrupt/hand-edited doc)", () => {
    const record = normalizeSchoolLaunchRecord("school-1", { sessions: "not-an-array" as unknown as SchoolLaunchRecord["sessions"] });
    expect(record.sessions).toEqual([]);
  });
});

describe("computeSchoolLaunchStatus — backward compatibility / brand-new school", () => {
  it("starts every school at the welcome stage with 0% progress", () => {
    const status = computeSchoolLaunchStatus(makeInput());
    expect(status.currentStage?.key).toBe("welcome");
    expect(status.progressPct).toBe(0);
    expect(status.isComplete).toBe(false);
    expect(status.completedRequiredCount).toBe(0);
    expect(status.blockers).toEqual([]);
  });

  it("derives 'not_applicable' for tasks with no review pipeline yet, and excludes them from required-task counts", () => {
    const status = computeSchoolLaunchStatus(makeInput());
    const validateTask = status.stages
      .flatMap(s => s.tasks)
      .find(t => t.key === "validateImportedChildren");
    expect(validateTask?.status).toBe("not_applicable");
    expect(validateTask?.required).toBe(false);
  });
});

describe("computeSchoolLaunchStatus — data-presence derivation", () => {
  it("marks school-provided stages completed once the underlying data exists", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(),
      hasSeenWelcome: true,
      counts: FULL_COUNTS,
    }));

    const byKey = Object.fromEntries(status.stages.flatMap(s => s.tasks).map(t => [t.key, t]));
    expect(byKey.welcomeAcknowledged.status).toBe("completed");
    expect(byKey.confirmSchoolDetails.status).toBe("completed");
    expect(byKey.uploadEnrolmentList.status).toBe("completed");
    expect(byKey.createFirstClass.status).toBe("completed");
    expect(byKey.inviteTeachers.status).toBe("completed");
    expect(byKey.inviteParents.status).toBe("completed");
    expect(byKey.provideFeeStructure.status).toBe("completed");
  });

  it("stops at team training when everything school-side is done but training hasn't happened", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(),
      hasSeenWelcome: true,
      counts: FULL_COUNTS,
    }));
    expect(status.currentStage?.key).toBe("teamTraining");
    expect(status.isComplete).toBe(false);
  });

  it("derives team training as scheduled/completed from a matching launch session", () => {
    const scheduled = computeSchoolLaunchStatus(makeInput({
      record: normalizeSchoolLaunchRecord("school-1", {
        sessions: [{ id: "s1", type: "teacher_training", title: "Teacher training", status: "scheduled", scheduledAt: "2026-07-24T14:00:00.000Z" }],
      }),
    }));
    const trainingTask = scheduled.stages.flatMap(s => s.tasks).find(t => t.key === "completeTeacherTraining");
    expect(trainingTask?.status).toBe("scheduled");
    expect(scheduled.nextSession?.type).toBe("teacher_training");

    const completed = computeSchoolLaunchStatus(makeInput({
      record: normalizeSchoolLaunchRecord("school-1", {
        sessions: [{ id: "s1", type: "teacher_training", title: "Teacher training", status: "completed" }],
      }),
    }));
    const completedTrainingTask = completed.stages.flatMap(s => s.tasks).find(t => t.key === "completeTeacherTraining");
    expect(completedTrainingTask?.status).toBe("completed");
  });

  it("reaches 100% and isComplete only once Go live is explicitly marked (launchedAt set)", () => {
    const almostDone = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(),
      hasSeenWelcome: true,
      counts: FULL_COUNTS,
      record: normalizeSchoolLaunchRecord("school-1", {
        sessions: [{ id: "s1", type: "teacher_training", title: "Teacher training", status: "completed" }],
      }),
    }));
    // Everything except launchReadiness/goLive done — readiness should
    // auto-complete since no other required task is outstanding.
    const readinessTask = almostDone.stages.flatMap(s => s.tasks).find(t => t.key === "finalReadinessConfirmation");
    expect(readinessTask?.status).toBe("completed");
    expect(almostDone.isComplete).toBe(false);
    expect(almostDone.currentStage?.key).toBe("goLive");

    const launched = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(),
      hasSeenWelcome: true,
      counts: FULL_COUNTS,
      record: normalizeSchoolLaunchRecord("school-1", {
        sessions: [{ id: "s1", type: "teacher_training", title: "Teacher training", status: "completed" }],
        launchedAt: "2026-07-28T09:00:00.000Z",
      }),
    }));
    expect(launched.isComplete).toBe(true);
    expect(launched.progressPct).toBe(100);
    expect(launched.currentStage).toBeNull();
  });
});

describe("computeSchoolLaunchStatus — staff overrides and blockers", () => {
  it("lets a taskOverride take precedence over the derived signal", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(), // would normally derive confirmSchoolDetails as completed
      record: normalizeSchoolLaunchRecord("school-1", {
        taskOverrides: {
          confirmSchoolDetails: { status: "blocked", blockingReason: "Duplicate school name — needs a rename" },
        },
      }),
    }));
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "confirmSchoolDetails");
    expect(task?.status).toBe("blocked");
    expect(status.blockers).toHaveLength(1);
    expect(status.blockers[0].blockingReason).toBe("Duplicate school name — needs a rename");
  });
});

describe("computeSchoolLaunchStatus — upload-aware derivation", () => {
  it("reflects an uploaded file's status even when the underlying count is still zero", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      uploads: {
        children: { id: "u1", schoolId: "school-1", kind: "children", fileName: "enrolment.csv", fileUrl: "https://x/enrolment.csv", status: "submitted", submittedAt: "2026-07-01T00:00:00.000Z", submittedBy: "owner-1" },
      },
    }));
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "uploadEnrolmentList");
    expect(task?.status).toBe("submitted");
  });

  it("mirrors under_review onto both the main task and its companion review task", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      uploads: {
        children: { id: "u1", schoolId: "school-1", kind: "children", fileName: "enrolment.csv", fileUrl: "https://x/enrolment.csv", status: "under_review", submittedAt: "2026-07-01T00:00:00.000Z", submittedBy: "owner-1" },
      },
    }));
    const byKey = Object.fromEntries(status.stages.flatMap(s => s.tasks).map(t => [t.key, t]));
    expect(byKey.uploadEnrolmentList.status).toBe("under_review");
    expect(byKey.validateImportedChildren.status).toBe("under_review");
  });

  it("surfaces upload feedback as the task's blockingReason and counts it as a blocker", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      uploads: {
        feeStructure: { id: "u1", schoolId: "school-1", kind: "feeStructure", fileName: "fees.xlsx", fileUrl: "https://x/fees.xlsx", status: "needs_changes", submittedAt: "2026-07-01T00:00:00.000Z", submittedBy: "owner-1", feedback: "Missing fees for the toddler class" },
      },
    }));
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "provideFeeStructure");
    expect(task?.status).toBe("needs_changes");
    expect(task?.blockingReason).toBe("Missing fees for the toddler class");
    expect(status.blockers.some(t => t.key === "provideFeeStructure")).toBe(true);
  });

  it("marks the task completed once accepted, regardless of the manual-count signal", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      counts: ZERO_COUNTS,
      uploads: {
        teachers: { id: "u1", schoolId: "school-1", kind: "teachers", fileName: "teachers.csv", fileUrl: "https://x/teachers.csv", status: "accepted", submittedAt: "2026-07-01T00:00:00.000Z", submittedBy: "owner-1" },
      },
    }));
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "inviteTeachers");
    expect(task?.status).toBe("completed");
  });

  it("falls back to the manual/count-based signal when no upload exists at all (manual path, or a school predating uploads)", () => {
    const status = computeSchoolLaunchStatus(makeInput({ counts: FULL_COUNTS }));
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "inviteParents");
    expect(task?.status).toBe("completed");
    const review = status.stages.flatMap(s => s.tasks).find(t => t.key === "parentInvitationReview");
    expect(review?.status).toBe("not_applicable");
  });

  it("exposes the secondary manual-alternative action alongside the primary upload action", () => {
    const status = computeSchoolLaunchStatus(makeInput());
    const task = status.stages.flatMap(s => s.tasks).find(t => t.key === "uploadEnrolmentList");
    expect(task?.actionType).toBe("upload");
    expect(task?.secondaryActionHref).toBe("/onboarding/add-child");
    expect(task?.secondaryActionLabel).toBe("Add manually instead");
  });
});

describe("getLaunchReadiness", () => {
  it("treats onboarding payment as recommended (not required) while enforcement is disabled", () => {
    const status = computeSchoolLaunchStatus(makeInput());
    const readiness = getLaunchReadiness(status);
    const paymentCheck = [...readiness.requiredForLaunch, ...readiness.recommendedAfterLaunch]
      .find(c => c.key === "onboardingPaymentComplete");
    expect(readiness.requiredForLaunch.some(c => c.key === "onboardingPaymentComplete")).toBe(false);
    expect(paymentCheck).toBeDefined();
    expect(paymentCheck?.met).toBe(false); // unpaid by default, but not blocking
  });

  it("is ready for launch once every required check is met, regardless of payment", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      school: makeSchool(),
      hasSeenWelcome: true,
      counts: FULL_COUNTS,
      record: normalizeSchoolLaunchRecord("school-1", {
        sessions: [{ id: "s1", type: "teacher_training", title: "Teacher training", status: "completed" }],
      }),
    }));
    const readiness = getLaunchReadiness(status);
    expect(readiness.isReadyForLaunch).toBe(true);
  });

  it("surfaces human-readable blocker messages", () => {
    const status = computeSchoolLaunchStatus(makeInput({
      record: normalizeSchoolLaunchRecord("school-1", {
        taskOverrides: {
          inviteParents: { status: "needs_changes", blockingReason: "Parent details are missing for 6 children" },
        },
      }),
    }));
    const readiness = getLaunchReadiness(status);
    expect(readiness.blockerMessages).toContain("Parent details are missing for 6 children");
  });
});
