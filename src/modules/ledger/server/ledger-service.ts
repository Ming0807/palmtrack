import type { IdentitySession } from "@/modules/identity/server/session";
import {
  createExpenseSchema,
  createSaleSchema,
  deleteExpenseSchema,
  deleteSaleSchema,
  periodFilterSchema,
  type CashLedgerSummary,
  type ExpenseItem,
  type SaleItem,
} from "../domain/ledger-model";
import type { LedgerGateway } from "./ledger-gateway";

type AuthorizedFarmerSession = Extract<IdentitySession, { status: "authorized" }>;

function isAuthorizedFarmer(session: IdentitySession): session is AuthorizedFarmerSession {
  return session.status === "authorized" && session.profile.role === "farmer";
}

export type WorkbenchDataResult =
  | {
      status: "ready";
      summary: CashLedgerSummary;
      expenses: ExpenseItem[];
      sales: SaleItem[];
    }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function getWorkbenchData({
  session,
  gateway,
  filter,
}: {
  session: IdentitySession;
  gateway: LedgerGateway;
  filter?: unknown;
}): Promise<WorkbenchDataResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsedFilter = periodFilterSchema.safeParse(filter ?? {});
  const filterData = parsedFilter.success ? parsedFilter.data : {};

  try {
    const [summary, expenses, sales] = await Promise.all([
      gateway.getSummary({
        farmId: filterData.farmId,
        fromDate: filterData.fromDate,
        toDate: filterData.toDate,
      }),
      gateway.listExpenses({
        farmId: filterData.farmId,
        fromDate: filterData.fromDate,
        toDate: filterData.toDate,
        includeDeleted: true,
      }),
      gateway.listSales({
        farmId: filterData.farmId,
        fromDate: filterData.fromDate,
        toDate: filterData.toDate,
        includeDeleted: true,
      }),
    ]);

    return {
      status: "ready",
      summary,
      expenses,
      sales,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลบัญชีได้";
    return { status: "error", message };
  }
}

export type LedgerMutationResult<T = void> =
  | { status: "success"; data?: T }
  | { status: "forbidden" }
  | { status: "validation_error"; error: string }
  | { status: "error"; message: string };

export async function createExpense({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: LedgerGateway;
  input: unknown;
}): Promise<LedgerMutationResult<string>> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลค่าใช้จ่ายไม่ถูกต้อง",
    };
  }

  try {
    const expenseId = await gateway.createExpense(parsed.data);
    return { status: "success", data: expenseId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกค่าใช้จ่ายได้";
    return { status: "error", message };
  }
}

export async function deleteExpense({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: LedgerGateway;
  input: unknown;
}): Promise<LedgerMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "เหตุผลการลบไม่ถูกต้อง",
    };
  }

  try {
    await gateway.softDeleteExpense(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถลบรายการค่าใช้จ่ายได้";
    return { status: "error", message };
  }
}

export async function createSale({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: LedgerGateway;
  input: unknown;
}): Promise<LedgerMutationResult<string>> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = createSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลการขายไม่ถูกต้อง",
    };
  }

  try {
    const saleId = await gateway.createSale(parsed.data);
    return { status: "success", data: saleId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกการขายได้";
    return { status: "error", message };
  }
}

export async function deleteSale({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: LedgerGateway;
  input: unknown;
}): Promise<LedgerMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = deleteSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "เหตุผลการลบไม่ถูกต้อง",
    };
  }

  try {
    await gateway.softDeleteSale(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถลบรายการขายได้";
    return { status: "error", message };
  }
}
