"use client";

import {
  BookOpenText,
  ClipboardList,
  Cloud,
  CloudOff,
  Menu,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { getConnectionMessage, type PrototypeState } from "./model";

export function PrototypeHeader({ state }: { state: PrototypeState }) {
  const offline = state === "offline";
  const syncing = state === "syncing";
  const ConnectionIcon = offline ? CloudOff : syncing ? RefreshCw : Cloud;

  return (
    <>
      <header className="pt-topbar">
        <Link className="pt-brand" href="/prototype/field?variant=A">
          PalmTrack
        </Link>
        <div className="pt-topbar-actions">
          <span className="pt-synthetic-badge">
            <BookOpenText aria-hidden="true" size={17} />
            ข้อมูลตัวอย่าง
          </span>
          <button
            aria-label="เมนูยังไม่เปิดในต้นแบบ"
            className="pt-icon-action"
            disabled
            title="ยังไม่เปิดในต้นแบบ"
            type="button"
          >
            <Menu aria-hidden="true" size={22} />
          </button>
        </div>
      </header>
      <div aria-live="polite" className={`pt-connection pt-connection--${state}`}>
        <ConnectionIcon
          aria-hidden="true"
          className={syncing ? "pt-spin" : undefined}
          size={18}
        />
        <span>{getConnectionMessage(state)}</span>
      </div>
    </>
  );
}

export function PrototypeBottomNav({ active = "queue" }: { active?: "queue" | "draft" }) {
  return (
    <nav aria-label="เมนูหลักตัวอย่าง" className="pt-bottom-nav">
      <Link aria-current={active === "queue" ? "page" : undefined} href="/prototype/field?variant=A">
        <ClipboardList aria-hidden="true" size={22} />
        <span>งานของฉัน</span>
      </Link>
      <button
        aria-current={active === "draft" ? "page" : undefined}
        disabled
        title="ยังไม่เปิดในต้นแบบ"
        type="button"
      >
        <BookOpenText aria-hidden="true" size={22} />
        <span>สมุดบันทึก</span>
      </button>
      <button disabled title="ยังไม่เปิดในต้นแบบ" type="button">
        <Send aria-hidden="true" size={22} />
        <span>ส่งข้อมูล</span>
      </button>
    </nav>
  );
}
