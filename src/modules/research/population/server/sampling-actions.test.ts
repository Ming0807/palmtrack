import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  identityGateway: vi.fn(),
  resolveSession: vi.fn(),
  samplingGateway: vi.fn(),
  draft: vi.fn(),
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
vi.mock("@/modules/research/population/server/sampling-gateway", () => ({
  createSupabaseSamplingGateway: mocks.samplingGateway,
}));
vi.mock("@/modules/research/population/server/sampling-service", async (load) => {
  const actual = await load<typeof import("./sampling-service")>();
  return {
    ...actual,
    createSamplingDraft: mocks.draft,
    lockSamplingRun: mocks.lock,
    activateSamplingRun: mocks.activate,
    cancelSamplingRun: mocks.cancel,
  };
});

import {
  activateSamplingRunAction,
  cancelSamplingRunAction,
  createSamplingDraftAction,
  lockSamplingRunAction,
} from "@/modules/research/population/server/sampling-actions";

function draftForm(): FormData {
  const form = new FormData();
  form.set("populationImportId", "11111111-1111-4111-8111-111111111111");
  form.set("marginOfError", "0.05");
  form.set("seedText", "palmtrack-acceptance-seed-v1");
  form.set("seedNormalized", "palmtrack-acceptance-seed-v1");
  form.set("seedDigestHex", "a".repeat(64));
  form.set("seedU32", "0");
  form.set("candidateHash", "b".repeat(64));
  form.set("allocationsJson", JSON.stringify([{ stratumCode: "NORTH", finalAllocation: 1 }]));
  form.set(
    "membersJson",
    JSON.stringify([
      {
        populationMemberId: "22222222-2222-4222-8222-222222222222",
        stratumCode: "NORTH",
        selectionOrder: 1,
      },
    ]),
  );
  return form;
}

describe("sampling server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ status: "configured", client: {} });
    mocks.identityGateway.mockReturnValue({});
    mocks.resolveSession.mockResolvedValue({ status: "authorized" });
    mocks.samplingGateway.mockReturnValue({});
  });

  it("[SEC-02] rejects malformed evidence JSON before resolving session", async () => {
    const form = draftForm();
    form.set("membersJson", "not-json");
    await expect(createSamplingDraftAction({ status: "idle" }, form)).resolves.toMatchObject({
      status: "invalid",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("[INT-02] creates a draft then revalidates the sampling route", async () => {
    mocks.draft.mockResolvedValue({ status: "draft", runId: "run-1", receipt: {} });
    await expect(createSamplingDraftAction({ status: "idle" }, draftForm())).resolves.toMatchObject({
      status: "draft",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/research/sampling");
  });

  it("[INT-02] locks, activates and cancels through actions", async () => {
    mocks.lock.mockResolvedValue({ status: "locked", runId: "run-1", receipt: {} });
    mocks.activate.mockResolvedValue({ status: "active", runId: "run-1", receipt: {} });
    mocks.cancel.mockResolvedValue({ status: "cancelled", runId: "run-1", receipt: {} });
    const lockForm = new FormData();
    lockForm.set("runId", "11111111-1111-4111-8111-111111111111");
    lockForm.set("candidateHash", "b".repeat(64));
    lockForm.set("seedDigestHex", "a".repeat(64));
    await expect(lockSamplingRunAction({ status: "idle" }, lockForm)).resolves.toMatchObject({
      status: "locked",
    });
    const activateForm = new FormData();
    activateForm.set("runId", "11111111-1111-4111-8111-111111111111");
    await expect(activateSamplingRunAction({ status: "idle" }, activateForm)).resolves.toMatchObject({
      status: "active",
    });
    const cancelForm = new FormData();
    cancelForm.set("runId", "11111111-1111-4111-8111-111111111111");
    cancelForm.set("reason", "ยุติรอบทดสอบสังเคราะห์");
    await expect(cancelSamplingRunAction({ status: "idle" }, cancelForm)).resolves.toMatchObject({
      status: "cancelled",
    });
  });
});
