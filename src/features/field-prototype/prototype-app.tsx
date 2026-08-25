"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PrototypeState, PrototypeVariant } from "./model";
import { PrototypeBottomNav, PrototypeHeader } from "./prototype-chrome";
import { QueueVariant, ReceiptVariant, RouteVariant } from "./queue-variants";
import { StateBoundary } from "./state-boundary";
import { StateLab } from "./state-lab";
import { VariantSwitcher } from "./variant-switcher";

type FieldPrototypeProps = {
  initialVariant: PrototypeVariant;
  initialState: PrototypeState;
};

export function FieldPrototype({
  initialVariant,
  initialState,
}: FieldPrototypeProps) {
  const router = useRouter();
  const [variant, setVariant] = useState(initialVariant);
  const [prototypeState, setPrototypeState] = useState(initialState);

  function changeVariant(next: PrototypeVariant) {
    setVariant(next);
    router.replace(buildHomeHref(next, prototypeState), { scroll: false });
  }

  function changeState(next: PrototypeState) {
    setPrototypeState(next);
    router.replace(buildHomeHref(variant, next), { scroll: false });
  }

  return (
    <main className={`pt-app pt-app--variant-${variant.toLowerCase()}`}>
      <a className="pt-skip-link" href="#prototype-content">
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <div className="pt-app-frame">
        <PrototypeHeader state={prototypeState} />
        <div id="prototype-content" className="pt-content" tabIndex={-1}>
          <StateBoundary state={prototypeState}>
            {variant === "A" ? <QueueVariant /> : null}
            {variant === "B" ? <ReceiptVariant /> : null}
            {variant === "C" ? <RouteVariant /> : null}
          </StateBoundary>
        </div>
        <PrototypeBottomNav />
      </div>

      <aside aria-label="เครื่องมือเปรียบเทียบต้นแบบ" className="pt-prototype-tools">
        <VariantSwitcher current={variant} onVariantChange={changeVariant} />
        <StateLab current={prototypeState} onStateChange={changeState} />
        <p>เครื่องมือ local-only · ไม่มีการเชื่อม backend</p>
      </aside>
    </main>
  );
}

function buildHomeHref(variant: PrototypeVariant, state: PrototypeState) {
  const params = new URLSearchParams({ variant });
  if (state !== "default") {
    params.set("state", state);
  }
  return `/prototype/field?${params.toString()}`;
}
