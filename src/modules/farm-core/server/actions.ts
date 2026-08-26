"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { createSupabaseFarmGateway } from "./farm-gateway";
import {
  createFarm,
  createPlot,
  deleteFarm,
  deletePlot,
  updateFarm,
  updatePlot,
} from "./farm-service";

const GARDENS_PATH = "/app/gardens";
const GARDEN_ACCOUNT_PATH = "/app/garden-account";
const DASHBOARD_PATH = "/app";

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export type FarmFormState = {
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
    gateway: createSupabaseFarmGateway(result.client),
  };
}

export async function createFarmAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const name = textField(formData, "name") ?? "";
  const locationLabel = textField(formData, "locationLabel");
  const totalArea = textField(formData, "totalArea") ?? "";

  const result = await createFarm({
    session: deps.session,
    gateway: deps.gateway,
    input: { name, locationLabel, totalArea },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "บันทึกข้อมูลสวนสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function updateFarmAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const farmId = textField(formData, "farmId") ?? "";
  const name = textField(formData, "name") ?? "";
  const locationLabel = textField(formData, "locationLabel");
  const totalArea = textField(formData, "totalArea") ?? "";

  const result = await updateFarm({
    session: deps.session,
    gateway: deps.gateway,
    input: { farmId, name, locationLabel, totalArea },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "แก้ไขข้อมูลสวนสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function deleteFarmAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const farmId = textField(formData, "farmId") ?? "";
  const reason = textField(formData, "reason") ?? "";

  const result = await deleteFarm({
    session: deps.session,
    gateway: deps.gateway,
    input: { farmId, reason },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    revalidatePath(DASHBOARD_PATH);
    return { status: "success", message: "ลบสวนสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function createPlotAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const farmId = textField(formData, "farmId") ?? "";
  const code = textField(formData, "code") ?? "";
  const name = textField(formData, "name") ?? "";
  const area = textField(formData, "area") ?? "";

  const result = await createPlot({
    session: deps.session,
    gateway: deps.gateway,
    input: { farmId, code, name, area },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    return { status: "success", message: "บันทึกข้อมูลแปลงสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function updatePlotAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const plotId = textField(formData, "plotId") ?? "";
  const code = textField(formData, "code") ?? "";
  const name = textField(formData, "name") ?? "";
  const area = textField(formData, "area") ?? "";

  const result = await updatePlot({
    session: deps.session,
    gateway: deps.gateway,
    input: { plotId, code, name, area },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    return { status: "success", message: "แก้ไขข้อมูลแปลงสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}

export async function deletePlotAction(
  _prevState: FarmFormState,
  formData: FormData,
): Promise<FarmFormState> {
  const deps = await getDependencies();
  if (!deps) {
    return { status: "error", message: "ระบบฐานข้อมูลไม่พร้อมใช้งาน" };
  }

  const plotId = textField(formData, "plotId") ?? "";
  const reason = textField(formData, "reason") ?? "";

  const result = await deletePlot({
    session: deps.session,
    gateway: deps.gateway,
    input: { plotId, reason },
  });

  if (result.status === "success") {
    revalidatePath(GARDENS_PATH);
    revalidatePath(GARDEN_ACCOUNT_PATH);
    return { status: "success", message: "ลบแปลงสำเร็จ" };
  }

  if (result.status === "validation_error") {
    return { status: "validation_error", error: result.error };
  }

  if (result.status === "forbidden") {
    return { status: "forbidden", error: "ไม่มีสิทธิ์ดำเนินการ" };
  }

  return { status: "error", message: result.message };
}
