import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseLedgerGateway } from "./ledger-gateway";

describe("Supabase ledger gateway decimal contract", () => {
  it("sends canonical decimal strings to sale RPC parameters", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "sale-id", error: null });
    const gateway = createSupabaseLedgerGateway({ rpc } as unknown as SupabaseClient);

    await gateway.createSale({
      farmId: "11111111-1111-4111-8111-111111111111",
      plotId: null,
      saleDate: "2026-08-26",
      buyerName: null,
      quantity: "90071992547.123",
      unitPrice: "123.45",
      deductions: "0.00",
      notes: null,
    });

    expect(rpc).toHaveBeenCalledWith("create_sale", expect.objectContaining({
      p_quantity: "90071992547.123",
      p_unit_price: "123.45",
      p_deductions: "0.00",
    }));
  });

  it("preserves canonical decimal strings returned by the summary RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        net_income: "9007199254740993.25",
        expense_total: "0.00",
        cash_result: "9007199254740993.25",
        sale_count: 1,
        expense_count: 0,
        has_records: true,
      }],
      error: null,
    });
    const gateway = createSupabaseLedgerGateway({ rpc } as unknown as SupabaseClient);

    const summary = await gateway.getSummary();

    expect(summary.netIncome).toBe("9007199254740993.25");
    expect(summary.cashResult).toBe("9007199254740993.25");
  });
});
