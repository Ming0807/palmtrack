"use client";

import type { KeyboardEvent } from "react";
import { prototypeVariants, type PrototypeVariant } from "./model";

const labels: Record<PrototypeVariant, string> = {
  A: "A คิวงาน",
  B: "B ใบชั่ง",
  C: "C เส้นทางหลักฐาน",
};

type VariantSwitcherProps = {
  current: PrototypeVariant;
  onVariantChange: (variant: PrototypeVariant) => void;
};

export function VariantSwitcher({
  current,
  onVariantChange,
}: VariantSwitcherProps) {
  function move(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const currentIndex = prototypeVariants.indexOf(current);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + prototypeVariants.length) %
      prototypeVariants.length;
    onVariantChange(prototypeVariants[nextIndex]);
  }

  return (
    <div
      aria-label="เปรียบเทียบโครงหน้าจอ"
      className="pt-variant-switcher"
      onKeyDown={move}
      role="radiogroup"
      tabIndex={0}
    >
      <span className="pt-variant-label">โครง</span>
      {prototypeVariants.map((variant) => (
        <button
          aria-checked={current === variant}
          className="pt-variant-option"
          key={variant}
          onClick={() => onVariantChange(variant)}
          role="radio"
          tabIndex={-1}
          type="button"
        >
          {labels[variant]}
        </button>
      ))}
    </div>
  );
}
