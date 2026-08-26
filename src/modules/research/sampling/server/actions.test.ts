import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  samplingGateway: vi.fn(),
  preview: vi.fn(),
  createDraft: vi.fn(),
  lock: vi.fn(),
  activate: vi.fn(),
  cancel: vi.fn(),
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
vi.mock("@/modules/research/sampling/server/sampling-gateway", () => ({
  createSupabaseSamplingGateway: mocks.samplingGateway,
}));
vi.mock("@/modules/research/sampling/server/sampling-service", () => ({
  previewSampling: mocks.preview,
  createSamplingDraft: mocks.createDraft,
  lockSamplingRun: mocks.lock,
  activateSamplingRun: mocks.activate,
  cancelSamplingRun: mocks.cancel,
}));

import {
  activateSamplingRunAction,
  cancelSamplingRunAction,
  createSamplingDraftAction,
  lockSamplingRunAction,
  previewSamplingAction,
} from "@/modules/research/sampling/server/actions";

describe("sampling server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({
      status: "authorized",
      userId: "user-1",
      profile: {
        id: "profile-1",
        workspaceId: "workspace-1",
        role: "research_manager",
      },
    });
    mocks.samplingGateway.mockReturnValue({});
  });

  it("parses preview fields without coercing non-string FormData values", async () => {
    const form = new FormData();
    form.set("populationImportId", new File(["not-an-id"], "id.txt"));
    form.set("seedText", "seed-v1");
    form.set("marginOfError", "0.05");
    form.set("stratumDefinitionVersion", "strata-v1");

    await expect(previewSamplingAction({ status: "invalid" }, form)).resolves.toEqual({
      status: "invalid",
    });
    expect(mocks.resolveSession).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("resolves the verified session and delegates a valid preview without revalidation", async () => {
    mocks.preview.mockResolvedValue({ status: "ready", evidence: { targetN: 93 } });
    const form = new FormData();
    form.set("populationImportId", "11111111-1111-4111-8111-111111111111");
    form.set("seedText", "seed-v1");
    form.set("marginOfError", "0.05");
    form.set("stratumDefinitionVersion", "strata-v1");

    await expect(previewSamplingAction({ status: "invalid" }, form)).resolves.toMatchObject({
      status: "ready",
    });
    expect(mocks.resolveSession).toHaveBeenCalledTimes(1);
    expect(mocks.preview).toHaveBeenCalledWith(
      {
        populationImportId: "11111111-1111-4111-8111-111111111111",
        seedText: "seed-v1",
        marginOfError: 0.05,
        stratumDefinitionVersion: "strata-v1",
      },
      expect.objectContaining({ session: expect.objectContaining({ status: "authorized" }) }),
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the service authorization state for an anonymous session", async () => {
    mocks.resolveSession.mockResolvedValue({ status: "anonymous" });
    mocks.createDraft.mockResolvedValue({ status: "forbidden" });
    const form = new FormData();
    form.set("populationImportId", "11111111-1111-4111-8111-111111111111");
    form.set("seedText", "seed-v1");
    form.set("marginOfError", "0.05");
    form.set("stratumDefinitionVersion", "strata-v1");
    form.set("idempotencyKey", "22222222-2222-4222-8222-222222222222");

    await expect(createSamplingDraftAction({ status: "invalid" }, form)).resolves.toEqual({
      status: "forbidden",
    });
    expect(mocks.createDraft).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ session: { status: "anonymous" } }),
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates only after a successful draft mutation", async () => {
    mocks.createDraft.mockResolvedValue({ status: "ready", run: { id: "run-1" } });
    const form = new FormData();
    form.set("populationImportId", "11111111-1111-4111-8111-111111111111");
    form.set("seedText", "seed-v1");
    form.set("marginOfError", "0.05");
    form.set("stratumDefinitionVersion", "strata-v1");
    form.set("idempotencyKey", "22222222-2222-4222-8222-222222222222");

    await expect(createSamplingDraftAction({ status: "invalid" }, form)).resolves.toMatchObject({
      status: "ready",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/research/sampling");

    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.resolveSession.mockResolvedValue({ status: "authorized", profile: { role: "research_manager" } });
    mocks.samplingGateway.mockReturnValue({});
    mocks.createDraft.mockResolvedValue({ status: "conflict" });
    await expect(createSamplingDraftAction({ status: "invalid" }, form)).resolves.toEqual({ status: "conflict" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["lock", lockSamplingRunAction, "lock", new Map([["runId", "11111111-1111-4111-8111-111111111111"]])],
    ["activate", activateSamplingRunAction, "activate", new Map([["runId", "11111111-1111-4111-8111-111111111111"]])],
  ] as const)("does not revalidate a failed %s mutation", async (_name, action, method, entries) => {
    const form = new FormData();
    for (const [key, value] of entries) form.set(key, value);
    mocks[method].mockResolvedValue({ status: "conflict" });
    await expect(action({ status: "invalid" }, form)).resolves.toEqual({ status: "conflict" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("parses cancellation reason as text and revalidates on success", async () => {
    mocks.cancel.mockResolvedValue({ status: "ready", run: { id: "run-1" } });
    const form = new FormData();
    form.set("runId", "11111111-1111-4111-8111-111111111111");
    form.set("reason", "ยกเลิกชุดสังเคราะห์");
    await expect(cancelSamplingRunAction({ status: "invalid" }, form)).resolves.toMatchObject({ status: "ready" });
    expect(mocks.cancel).toHaveBeenCalledWith(
      { runId: "11111111-1111-4111-8111-111111111111", reason: "ยกเลิกชุดสังเคราะห์" },
      expect.any(Object),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/research/sampling");
  });
});
