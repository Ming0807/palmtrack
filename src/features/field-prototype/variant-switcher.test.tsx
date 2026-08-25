import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { VariantSwitcher } from "./variant-switcher";

describe("VariantSwitcher", () => {
  it("moves across A, B, C with arrow keys and announces the selected structure", async () => {
    const user = userEvent.setup();
    const onVariantChange = vi.fn();

    render(<VariantSwitcher current="A" onVariantChange={onVariantChange} />);

    const group = screen.getByRole("radiogroup", {
      name: "เปรียบเทียบโครงหน้าจอ",
    });
    group.focus();
    await user.keyboard("{ArrowRight}");
    expect(onVariantChange).toHaveBeenLastCalledWith("B");

    await user.click(screen.getByRole("radio", { name: /C เส้นทางหลักฐาน/u }));
    expect(onVariantChange).toHaveBeenLastCalledWith("C");
  });
});
