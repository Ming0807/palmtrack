import { z } from "zod";

import type { IdentitySession } from "@/modules/identity/server/session";
import { validateAreaRai, validateDeleteReason, validateFarmName } from "@/modules/farm/domain/farm-profile";
import { FarmGatewayError, type FarmGateway, type FarmInput, type FarmReceipt } from "./farm-gateway";

export type FarmActionState =
  | { status: "idle" }
  | { status: "invalid"; reasonCode: string }
  | { status: "forbidden" }
  | { status: "conflict" }
  | { status: "service_unavailable" }
  | { status: "created"; farm: FarmReceipt }
  | { status: "deleted"; farmId: string };

export type FarmListState =
  | { status: "ready"; farms: FarmReceipt[] }
  | { status: "forbidden" }
  | { status: "service_unavailable" };

type Dependencies = { session: IdentitySession; gateway: FarmGateway };

function canManageFarm(session: IdentitySession): boolean {
  return session.status === "authorized" && session.profile.role === "farmer";
}

function gatewayFailure(error: unknown): FarmActionState {
  return error instanceof FarmGatewayError && error.code === "CONFLICT"
    ? { status: "conflict" }
    : { status: "service_unavailable" };
}

export async function createFarm(input: FarmInput, deps: Dependencies): Promise<FarmActionState> {
  if (!canManageFarm(deps.session)) return { status: "forbidden" };
  const name = validateFarmName(input.name);
  if (name.status !== "valid") return { status: "invalid", reasonCode: "INVALID_FARM_NAME" };
  const area = validateAreaRai(input.areaRai);
  if (area.status !== "valid") return { status: "invalid", reasonCode: "INVALID_FARM_AREA" };
  try {
    const farm = await deps.gateway.createFarm({ name: name.name, areaRai: area.areaRai });
    return { status: "created", farm };
  } catch (error) {
    return gatewayFailure(error);
  }
}

export async function listFarms(deps: Dependencies): Promise<FarmListState> {
  if (!canManageFarm(deps.session)) return { status: "forbidden" };
  try {
    return { status: "ready", farms: await deps.gateway.listFarms() };
  } catch {
    return { status: "service_unavailable" };
  }
}

export async function deleteFarm(
  farmId: string,
  reason: string,
  deps: Dependencies,
): Promise<FarmActionState> {
  if (!canManageFarm(deps.session)) return { status: "forbidden" };
  if (!z.uuid().safeParse(farmId).success) return { status: "conflict" };
  const parsed = validateDeleteReason(reason);
  if (parsed.status !== "valid") return { status: "invalid", reasonCode: "INVALID_DELETE_REASON" };
  try {
    const deleted = await deps.gateway.deleteFarm(farmId, parsed.name);
    return { status: "deleted", farmId: deleted.id };
  } catch (error) {
    return gatewayFailure(error);
  }
}
