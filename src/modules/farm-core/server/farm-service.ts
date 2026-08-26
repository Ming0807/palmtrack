import type { IdentitySession } from "@/modules/identity/server/session";
import {
  createFarmSchema,
  createPlotSchema,
  deleteFarmSchema,
  deletePlotSchema,
  updateFarmSchema,
  updatePlotSchema,
  type FarmSummary,
  type PlotSummary,
} from "../domain/farm-model";
import type { FarmGateway } from "./farm-gateway";

type AuthorizedFarmerSession = Extract<IdentitySession, { status: "authorized" }>;

function isAuthorizedFarmer(session: IdentitySession): session is AuthorizedFarmerSession {
  return session.status === "authorized" && session.profile.role === "farmer";
}

export type FarmListResult =
  | { status: "ready"; farms: FarmSummary[] }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function listFarms({
  session,
  gateway,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
}): Promise<FarmListResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  try {
    const farms = await gateway.listFarms();
    return { status: "ready", farms };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลสวนได้";
    return { status: "error", message };
  }
}

export type ServiceMutationResult<T = void> =
  | { status: "success"; data?: T }
  | { status: "forbidden" }
  | { status: "validation_error"; error: string }
  | { status: "error"; message: string };

export async function createFarm({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult<string>> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = createFarmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลสวนไม่ถูกต้อง",
    };
  }

  try {
    const farmId = await gateway.createFarm(parsed.data);
    return { status: "success", data: farmId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถสร้างสวนได้";
    return { status: "error", message };
  }
}

export async function updateFarm({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = updateFarmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลสวนไม่ถูกต้อง",
    };
  }

  try {
    await gateway.updateFarm(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถแก้ไขสวนได้";
    return { status: "error", message };
  }
}

export async function deleteFarm({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = deleteFarmSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "เหตุผลการลบไม่ถูกต้อง",
    };
  }

  try {
    await gateway.softDeleteFarm(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถลบสวนได้";
    return { status: "error", message };
  }
}

export type PlotListResult =
  | { status: "ready"; plots: PlotSummary[] }
  | { status: "forbidden" }
  | { status: "error"; message: string };

export async function listPlots({
  session,
  gateway,
  farmId,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  farmId: string;
}): Promise<PlotListResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  try {
    const plots = await gateway.listPlots(farmId);
    return { status: "ready", plots };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลแปลงได้";
    return { status: "error", message };
  }
}

export async function createPlot({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult<string>> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = createPlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลแปลงไม่ถูกต้อง",
    };
  }

  try {
    const plotId = await gateway.createPlot(parsed.data);
    return { status: "success", data: plotId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถสร้างแปลงได้";
    return { status: "error", message };
  }
}

export async function updatePlot({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = updatePlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "ข้อมูลแปลงไม่ถูกต้อง",
    };
  }

  try {
    await gateway.updatePlot(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถแก้ไขแปลงได้";
    return { status: "error", message };
  }
}

export async function deletePlot({
  session,
  gateway,
  input,
}: {
  session: IdentitySession;
  gateway: FarmGateway;
  input: unknown;
}): Promise<ServiceMutationResult> {
  if (!isAuthorizedFarmer(session)) {
    return { status: "forbidden" };
  }

  const parsed = deletePlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "validation_error",
      error: parsed.error.issues[0]?.message ?? "เหตุผลการลบไม่ถูกต้อง",
    };
  }

  try {
    await gateway.softDeletePlot(parsed.data);
    return { status: "success" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถลบแปลงได้";
    return { status: "error", message };
  }
}
