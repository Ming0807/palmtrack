"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseIdentityGateway,
  resolveIdentitySession,
} from "@/modules/identity/server/session";
import { MAX_POPULATION_FILE_BYTES } from "@/modules/research/population/domain/population-import";
import { createSupabasePopulationGateway } from "@/modules/research/population/server/population-gateway";
import {
  acceptPopulationImport,
  createPopulationImport,
  type PopulationActionState,
} from "@/modules/research/population/server/population-service";

function invalidFile(reasonCode: string): PopulationActionState {
  return {
    status: "invalid",
    errors: [{ rowNumber: null, fieldCode: "file", reasonCode }],
  };
}

async function productionDependencies() {
  const result = await createSupabaseServerClient();
  if (result.status !== "configured") return null;
  const session = await resolveIdentitySession({
    gateway: createSupabaseIdentityGateway(result.client),
  });
  return {
    session,
    gateway: createSupabasePopulationGateway(result.client),
  };
}

export async function createPopulationImportAction(
  _previous: PopulationActionState,
  formData: FormData,
): Promise<PopulationActionState> {
  const file = formData.get("file");
  if (!(file instanceof File)) return invalidFile("FILE_REQUIRED");
  if (file.size > MAX_POPULATION_FILE_BYTES) return invalidFile("FILE_TOO_LARGE");

  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await createPopulationImport(
    {
      fileBytes: new Uint8Array(await file.arrayBuffer()),
      sourceLabel: String(formData.get("sourceLabel") ?? ""),
      sourceAuthorizationRef: String(
        formData.get("sourceAuthorizationRef") ?? "",
      ),
      referenceDate: String(formData.get("referenceDate") ?? ""),
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
    },
    deps,
  );
  if (state.status === "validated") {
    revalidatePath("/app/research/population");
  }
  return state;
}

export async function acceptPopulationImportAction(
  _previous: PopulationActionState,
  formData: FormData,
): Promise<PopulationActionState> {
  const deps = await productionDependencies();
  if (!deps) return { status: "service_unavailable" };
  const state = await acceptPopulationImport(
    String(formData.get("importId") ?? ""),
    deps,
  );
  if (state.status === "accepted") {
    revalidatePath("/app/research/population");
  }
  return state;
}
