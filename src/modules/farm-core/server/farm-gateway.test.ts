import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseFarmGateway } from "./farm-gateway";

describe("Supabase farm gateway decimal contract", () => {
  it("sends canonical decimal strings to numeric RPC parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "farm-id", error: null });
    const gateway = createSupabaseFarmGateway({ rpc } as unknown as SupabaseClient);

    await gateway.createFarm({
      name: "สวนทดสอบ",
      locationLabel: null,
      totalArea: "9007199254740.123",
    });

    expect(rpc).toHaveBeenCalledWith("create_farm", {
      p_name: "สวนทดสอบ",
      p_location_label: null,
      p_total_area: "9007199254740.123",
    });
  });

  it("preserves canonical decimal strings returned by the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: "farm-id",
          farmer_id: "farmer-id",
          name: "สวนทดสอบ",
          location_label: null,
          total_area: "9007199254740.123",
          plot_count: 0,
          created_at: "2026-08-26T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const gateway = createSupabaseFarmGateway({ rpc } as unknown as SupabaseClient);

    const [farm] = await gateway.listFarms();

    expect(farm?.totalArea).toBe("9007199254740.123");
  });
});
