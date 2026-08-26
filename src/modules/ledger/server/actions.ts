"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { createSupabaseLedgerGateway } from "./ledger-gateway";
import {
  createExpense,
  createSale,
  deleteExpense,
  deleteSale,
} from "./ledger-service";

const GARDEN_ACCOUNT_PATH = "/app/garden-account";
const DASHBOARD_PATH = "/app";

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export type LedgerFormState = {
  status: "idle" | "success" | "validation_error" | "forbidden" | "error";
  message?: string;
  error?: string;
};

async function getDependencies() {
  const result = await createSupabaseServerClient();
  if (result.status !== "configured") return null;
  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(result.client),
  });
  return {
    session,
    gateway: createSupabaseLedgerGateway(result.client),
  };
}

export async function createExpenseAction(
  _prevState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const farmId = textField(formData, "farmId") ?? "";
  const plotId = textField(formData, "plotId");
  const category = textField(formData, "category") ?? "";
  const amount = textField(formData, "amount") ?? "";
  const expenseDate = textField(formData, "expenseDate") ?? "";
  const notes = textField(formData, "notes");

  const result = await createExpense({
    session: deps.session,
    gateway: deps.gateway,
    input: {
      farmId,
      plotId: plotId ? plotId : null,
      category,
      amount,
      expenseDate,
      notes,
    },
  });

  if (result.status === "success") {
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "บันทึกค่าใช้จ่ายสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function deleteExpenseAction(
  _prevState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const expenseId = textField(formData, "expenseId") ?? "";
  const reason = textField(formData, "reason") ?? "";

  const result = await deleteExpense({
    session: deps.session,
    gateway: deps.gateway,
    input: { expenseId, reason },
  });

  if (result.status === "success") {
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "ลบรายการค่าใช้จ่ายสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function createSaleAction(
  _prevState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const farmId = textField(formData, "farmId") ?? "";
  const plotId = textField(formData, "plotId");
  const saleDate = textField(formData, "saleDate") ?? "";
  const buyerName = textField(formData, "buyerName");
  const quantity = textField(formData, "quantity") ?? "";
  const unitPrice = textField(formData, "unitPrice") ?? "";
  const deductions = textField(formData, "deductions") ?? "0.00";
  const notes = textField(formData, "notes");

  const result = await createSale({
    session: deps.session,
    gateway: deps.gateway,
    input: {
      farmId,
      plotId: plotId ? plotId : null,
      saleDate,
      buyerName,
      quantity,
      unitPrice,
      deductions,
      notes,
    },
  });

  if (result.status === "success") {
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "บันทึกการขายสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function deleteSaleAction(
  _prevState: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const saleId = textField(formData, "saleId") ?? "";
  const reason = textField(formData, "reason") ?? "";

  const result = await deleteSale({
    session: deps.session,
    gateway: deps.gateway,
    input: { saleId, reason },
  });

  if (result.status === "success") {
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "ลบรายการขายสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}
