import { describe, expect, it } from "vitest";

import {
  buildPrototypeDashboardModel,
  isPrototypeScenario,
} from "./dashboard-fixtures";

describe("dashboard prototype fixtures", () => {
  it("supports a deterministic loading scenario", () => {
    expect(isPrototypeScenario("loading")).toBe(true);
    expect(buildPrototypeDashboardModel("farmer", "loading").analytics.status).toBe("loading");
  });

  it.each(["farmer", "field_collector"] as const)(
    "does not expose research links to %s",
    (role) => {
      const research = buildPrototypeDashboardModel(role, "typical").research;
      expect(research.status).toBe("not_enabled");
      expect(JSON.stringify(research)).not.toContain("/app/research");
    },
  );

  it("keeps monetary trend values as canonical decimal strings", () => {
    const analytics = buildPrototypeDashboardModel("research_manager", "typical").analytics;
    expect(analytics.status).toBe("available");
    if (analytics.status !== "available") return;
    expect(analytics.trendRows[0]).toMatchObject({ income: "48200.00", expense: "31500.00" });
  });
});
