import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("Web App Manifest", () => {
  it("provides truthful install metadata without claiming offline sync", () => {
    const result = manifest();

    expect(result.name).toBe("PalmTrack");
    expect(result.short_name).toBe("PalmTrack");
    expect(result.lang).toBe("th");
    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
    expect(result.background_color).toBe("#f7f2e8");
    expect(result.theme_color).toBe("#233b68");

    // Icons must only reference existing assets
    expect(result.icons).toEqual([
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ]);

    // Description must be truthful and never claim offline capability
    expect(result.description).toBe("ระบบบริหารงานวิจัยและสวนปาล์มสำหรับโครงการศรีสาคร");
    expect(result.description?.toLowerCase()).not.toContain("offline");
  });
});
