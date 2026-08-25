import { beforeEach, describe, expect, it, vi } from "vitest";

import { FX_POPULATION_CSV } from "@/modules/research/population/domain/fixtures";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  populationGateway: vi.fn(),
  createImport: vi.fn(),
  acceptImport: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/modules/identity/server/session", () => ({
  createSupabaseIdentityGateway: mocks.identityGateway,
  resolveIdentitySession: mocks.resolveSession,
}));
vi.mock("@/modules/research/population/server/population-gateway", () => ({
  createSupabasePopulationGateway: mocks.populationGateway,
}));
vi.mock("@/modules/research/population/server/population-service", async (load) => {
  const actual = await load<typeof import("./population-service")>();
  return {
    ...actual,
    createPopulationImport: mocks.createImport,
    acceptPopulationImport: mocks.acceptImport,
  };
});

import {
  acceptPopulationImportAction,
  createPopulationImportAction,
} from "@/modules/research/population/server/actions";

describe("population server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({ status: "authorized" });
    mocks.populationGateway.mockReturnValue({});
  });

  it("[SEC-02] rejects a non-File payload before resolving session", async () => {
    const form = new FormData();
    form.set("file", "not-a-file");
    await expect(
      createPopulationImportAction({ status: "idle" }, form),
    ).resolves.toMatchObject({
      status: "invalid",
      errors: [expect.objectContaining({ reasonCode: "FILE_REQUIRED" })],
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("re-resolves identity, delegates bytes, and revalidates only on success", async () => {
    mocks.createImport.mockResolvedValue({
      status: "validated",
      importId: "11111111-1111-4111-8111-111111111111",
      receipt: {},
    });
    const form = new FormData();
    form.set("file", new File([FX_POPULATION_CSV], "population.csv"));
    form.set("sourceLabel", "บัญชีสังเคราะห์รอบ 1");
    form.set("sourceAuthorizationRef", "SYN-AUTH_001");
    form.set("referenceDate", "2026-08-25");
    form.set("idempotencyKey", "33333333-3333-4333-8333-333333333333");

    await expect(
      createPopulationImportAction({ status: "idle" }, form),
    ).resolves.toMatchObject({ status: "validated" });
    expect(mocks.resolveSession).toHaveBeenCalledTimes(1);
    expect(mocks.createImport).toHaveBeenCalledWith(
      expect.objectContaining({ fileBytes: expect.any(Uint8Array) }),
      expect.objectContaining({ session: { status: "authorized" } }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/research/population",
    );
  });

  it("re-resolves identity for acceptance and skips revalidation on failure", async () => {
    mocks.acceptImport.mockResolvedValue({ status: "conflict" });
    const form = new FormData();
    form.set("importId", "11111111-1111-4111-8111-111111111111");
    await expect(
      acceptPopulationImportAction({ status: "idle" }, form),
    ).resolves.toEqual({ status: "conflict" });
    expect(mocks.resolveSession).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
