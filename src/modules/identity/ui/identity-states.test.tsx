import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AnonymousSignInPrompt,
  ConfigurationErrorState,
  ForbiddenState,
  UnconfiguredState,
} from "./identity-states";

describe("identity boundary states", () => {
  it("explains unconfigured auth without fabricating a successful sign-in", () => {
    render(<UnconfiguredState />);

    expect(screen.getByRole("heading", { name: "ยังไม่ได้เชื่อมต่อระบบยืนยันตัวตน" })).toBeInTheDocument();
    expect(screen.getByText(/ตั้งค่า Supabase/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /เข้าสู่ระบบ/ })).not.toBeInTheDocument();
  });

  it("offers anonymous users only a real sign-in route", () => {
    render(<AnonymousSignInPrompt />);

    expect(screen.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ไปยังหน้าเข้าสู่ระบบ" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps configuration failures generic and secret-free", () => {
    render(<ConfigurationErrorState />);

    expect(screen.getByRole("heading", { name: "การเชื่อมต่อระบบไม่สมบูรณ์" })).toBeInTheDocument();
    expect(screen.queryByText(/SUPABASE|KEY|token|secret/i)).not.toBeInTheDocument();
  });

  it("uses the same non-enumerating forbidden copy for inactive access", () => {
    render(<ForbiddenState />);

    expect(screen.getByRole("heading", { name: "ไม่สามารถเข้าถึงหน้านี้ได้" })).toBeInTheDocument();
    expect(screen.getByText("หากคิดว่านี่เป็นข้อผิดพลาด โปรดติดต่อผู้ดูแลระบบ")).toBeInTheDocument();
    expect(screen.queryByText(/inactive|inactive_profile|บัญชี/)).not.toBeInTheDocument();
  });
});
