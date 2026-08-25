import {
  assignmentHref,
  canEditReturnedAssignment,
  getConnectionMessage,
  instrumentBoundary,
  parsePrototypeState,
  parseVariant,
  priorityAssignments,
  prototypeAssignments,
  workflowSteps,
} from "./model";

describe("field prototype contracts", () => {
  it("accepts only the three named structural variants", () => {
    expect(parseVariant("A")).toBe("A");
    expect(parseVariant("B")).toBe("B");
    expect(parseVariant("C")).toBe("C");
    expect(parseVariant("a")).toBe("A");
    expect(parseVariant("unknown")).toBe("A");
    expect(parseVariant(undefined)).toBe("A");
  });

  it("maps every required local state and safely defaults", () => {
    const supported = [
      "default",
      "loading",
      "empty",
      "validation",
      "forbidden",
      "not-found",
      "stale",
      "offline",
      "syncing",
      "service-unavailable",
      "success",
      "returned",
    ] as const;

    for (const state of supported) {
      expect(parsePrototypeState(state)).toBe(state);
    }
    expect(parsePrototypeState("invented")).toBe("default");
  });

  it("uses only visibly synthetic assignment fixtures", () => {
    expect(prototypeAssignments).toHaveLength(4);
    for (const assignment of prototypeAssignments) {
      expect(assignment.synthetic).toBe(true);
      expect(assignment.areaLabel).toMatch(/^พื้นที่ตัวอย่าง [ก-ฮ]-\d{2}$/u);
      expect(assignment.areaLabel).not.toMatch(/(จังหวัด|อำเภอ|ตำบล|หมู่บ้าน)/u);
      expect(assignment.id).toMatch(/^SSK-\d{3}$/u);
    }
  });

  it("keeps the operational queue in explicit priority order", () => {
    expect(priorityAssignments.map((assignment) => assignment.id)).toEqual([
      "SSK-024",
      "SSK-031",
      "SSK-017",
      "SSK-008",
    ]);
  });

  it("locks the protected workflow order and questionnaire boundary", () => {
    expect(workflowSteps.map((step) => step.key)).toEqual([
      "assigned",
      "notice-consent",
      "baseline",
      "farm-ledger",
      "review",
    ]);
    expect(instrumentBoundary.interactive).toBe(false);
    expect(instrumentBoundary.label).toBe("รออนุมัติเครื่องมือวิจัย");
    expect(instrumentBoundary.fields).toEqual([]);
    expect(instrumentBoundary.persistence).toBe("none");
  });

  it("requires an explicit resume action before a returned item is editable", () => {
    expect(canEditReturnedAssignment({ returned: true, resumed: false })).toBe(false);
    expect(canEditReturnedAssignment({ returned: true, resumed: true })).toBe(true);
    expect(canEditReturnedAssignment({ returned: false, resumed: false })).toBe(true);
  });

  it("describes local offline drafts without promising bidirectional sync", () => {
    expect(getConnectionMessage("offline")).toContain("บันทึกร่างไว้ในเครื่อง");
    expect(getConnectionMessage("offline")).toContain("ส่งเมื่อออนไลน์");
    expect(getConnectionMessage("offline")).not.toContain("ซิงก์สองทาง");
  });

  it("builds the canonical A-to-C assignment handoff", () => {
    expect(assignmentHref("SSK-024")).toBe(
      "/prototype/field/SSK-024?variant=C",
    );
  });
});
