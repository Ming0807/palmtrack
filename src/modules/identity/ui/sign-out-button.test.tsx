import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FormStatusResult =
  | { pending: true; data: FormData; method: string; action: string | ((formData: FormData) => void | Promise<void>) }
  | { pending: false; data: null; method: null; action: null };

const mocks = vi.hoisted(() => ({
  useFormStatus: vi.fn<() => FormStatusResult>(() => ({
    pending: false,
    data: null,
    method: null,
    action: null,
  })),
}));

vi.mock("server-only", () => ({}));

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: mocks.useFormStatus,
  };
});

vi.mock("@/modules/identity/server/actions", () => ({
  signOutAction: vi.fn(),
}));

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useFormStatus.mockReturnValue({
      pending: false,
      data: null,
      method: null,
      action: null,
    });
  });

  it("renders idle state with 'ออกจากระบบ' label and accessible button", () => {
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "ออกจากระบบ" });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("renders pending state with 'กำลังออกจากระบบ...' and disabled button when form is submitting", () => {
    mocks.useFormStatus.mockReturnValue({
      pending: true,
      data: new FormData(),
      method: "POST",
      action: "/mock",
    });

    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "ออกจากระบบ" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("กำลังออกจากระบบ...")).toBeInTheDocument();
  });
});
