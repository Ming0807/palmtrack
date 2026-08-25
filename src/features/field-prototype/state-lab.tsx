"use client";

import { SlidersHorizontal } from "lucide-react";
import { prototypeStates, type PrototypeState } from "./model";

const stateLabels: Record<PrototypeState, string> = {
  default: "ปกติ",
  loading: "กำลังโหลด",
  empty: "ไม่มีงาน",
  validation: "ข้อมูลไม่ครบ",
  forbidden: "ไม่มีสิทธิ์",
  "not-found": "ไม่พบข้อมูล",
  stale: "ข้อมูลเปลี่ยนแล้ว",
  offline: "ออฟไลน์",
  syncing: "กำลังส่ง",
  "service-unavailable": "บริการไม่พร้อม",
  success: "สำเร็จ",
  returned: "ส่งคืนแก้ไข",
};

type StateLabProps = {
  current: PrototypeState;
  onStateChange: (state: PrototypeState) => void;
};

export function StateLab({ current, onStateChange }: StateLabProps) {
  return (
    <details className="pt-state-lab">
      <summary>
        <SlidersHorizontal aria-hidden="true" size={17} />
        ทดลองสถานะ
        <span>{stateLabels[current]}</span>
      </summary>
      <div aria-label="สถานะหน้าจอตัวอย่าง" className="pt-state-options">
        {prototypeStates.map((state) => (
          <button
            aria-pressed={current === state}
            key={state}
            onClick={() => onStateChange(state)}
            type="button"
          >
            {stateLabels[state]}
          </button>
        ))}
      </div>
    </details>
  );
}
