import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CashLedgerSummary,
  CreateExpenseInput,
  CreateSaleInput,
  DeleteExpenseInput,
  DeleteSaleInput,
  ExpenseItem,
  SaleItem,
} from "../domain/ledger-model";

export type LedgerGateway = {
  listExpenses(params?: {
    farmId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    includeDeleted?: boolean;
  }): Promise<ExpenseItem[]>;
  createExpense(input: CreateExpenseInput): Promise<string>;
  softDeleteExpense(input: DeleteExpenseInput): Promise<void>;

  listSales(params?: {
    farmId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
    includeDeleted?: boolean;
  }): Promise<SaleItem[]>;
  createSale(input: CreateSaleInput): Promise<string>;
  softDeleteSale(input: DeleteSaleInput): Promise<void>;

  getSummary(params?: {
    farmId?: string | null;
    fromDate?: string | null;
    toDate?: string | null;
  }): Promise<CashLedgerSummary>;
};

export function createSupabaseLedgerGateway(client: SupabaseClient): LedgerGateway {
  return {
    async listExpenses(params) {
      const { data, error } = await client.rpc("list_my_expenses", {
        p_farm_id: params?.farmId ?? null,
        p_from_date: params?.fromDate ?? null,
        p_to_date: params?.toDate ?? null,
        p_include_deleted: params?.includeDeleted ?? false,
      });
      if (error) throw error;
      return (data ?? []).map((row: {
        id: string;
        farm_id: string;
        farm_name: string;
        plot_id: string | null;
        plot_code: string | null;
        category: string;
        amount: number | string;
        expense_date: string;
        notes: string | null;
        is_deleted: boolean;
        delete_reason: string | null;
        created_at: string;
      }) => ({
        id: row.id,
        farmId: row.farm_id,
        farmName: row.farm_name,
        plotId: row.plot_id,
        plotCode: row.plot_code,
        category: row.category,
        amount: Number(row.amount).toFixed(2),
        expenseDate: row.expense_date,
        notes: row.notes,
        isDeleted: row.is_deleted,
        deleteReason: row.delete_reason,
        createdAt: row.created_at,
      }));
    },

    async createExpense(input) {
      const { data, error } = await client.rpc("create_expense", {
        p_farm_id: input.farmId,
        p_plot_id: input.plotId ?? null,
        p_category: input.category,
        p_amount: Number(input.amount),
        p_expense_date: input.expenseDate,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },

    async softDeleteExpense(input) {
      const { error } = await client.rpc("soft_delete_expense", {
        p_expense_id: input.expenseId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },

    async listSales(params) {
      const { data, error } = await client.rpc("list_my_sales", {
        p_farm_id: params?.farmId ?? null,
        p_from_date: params?.fromDate ?? null,
        p_to_date: params?.toDate ?? null,
        p_include_deleted: params?.includeDeleted ?? false,
      });
      if (error) throw error;
      return (data ?? []).map((row: {
        id: string;
        farm_id: string;
        farm_name: string;
        plot_id: string | null;
        plot_code: string | null;
        sale_date: string;
        buyer_name: string | null;
        quantity: number | string;
        unit_price: number | string;
        gross_amount: number | string;
        deductions: number | string;
        net_amount: number | string;
        notes: string | null;
        is_deleted: boolean;
        delete_reason: string | null;
        created_at: string;
      }) => ({
        id: row.id,
        farmId: row.farm_id,
        farmName: row.farm_name,
        plotId: row.plot_id,
        plotCode: row.plot_code,
        saleDate: row.sale_date,
        buyerName: row.buyer_name,
        quantity: Number(row.quantity).toFixed(3),
        unitPrice: Number(row.unit_price).toFixed(2),
        grossAmount: Number(row.gross_amount).toFixed(2),
        deductions: Number(row.deductions).toFixed(2),
        netAmount: Number(row.net_amount).toFixed(2),
        notes: row.notes,
        isDeleted: row.is_deleted,
        deleteReason: row.delete_reason,
        createdAt: row.created_at,
      }));
    },

    async createSale(input) {
      const { data, error } = await client.rpc("create_sale", {
        p_farm_id: input.farmId,
        p_plot_id: input.plotId ?? null,
        p_sale_date: input.saleDate,
        p_buyer_name: input.buyerName ?? null,
        p_quantity: Number(input.quantity),
        p_unit_price: Number(input.unitPrice),
        p_deductions: Number(input.deductions),
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },

    async softDeleteSale(input) {
      const { error } = await client.rpc("soft_delete_sale", {
        p_sale_id: input.saleId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },

    async getSummary(params) {
      const { data, error } = await client.rpc("get_my_cash_ledger_summary", {
        p_farm_id: params?.farmId ?? null,
        p_from_date: params?.fromDate ?? null,
        p_to_date: params?.toDate ?? null,
      });
      if (error) throw error;
      const row = (data && data[0]) ?? {
        net_income: 0,
        expense_total: 0,
        cash_result: 0,
        sale_count: 0,
        expense_count: 0,
        has_records: false,
      };
      return {
        netIncome: Number(row.net_income).toFixed(2),
        expenseTotal: Number(row.expense_total).toFixed(2),
        cashResult: Number(row.cash_result).toFixed(2),
        saleCount: Number(row.sale_count),
        expenseCount: Number(row.expense_count),
        hasRecords: Boolean(row.has_records),
      };
    },
  };
}
