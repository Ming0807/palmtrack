"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssignmentRoute } from "./assignment-route";
import type { PrototypeState } from "./model";
import { priorityAssignments } from "./model";
import { PrototypeBottomNav, PrototypeHeader } from "./prototype-chrome";
import { StateBoundary } from "./state-boundary";
import { StateLab } from "./state-lab";

export function AssignmentPrototype({
  assignmentId,
  initialState,
}: {
  assignmentId: string;
  initialState: PrototypeState;
}) {
  const router = useRouter();
  const [prototypeState, setPrototypeState] = useState(initialState);

  function changeState(next: PrototypeState) {
    setPrototypeState(next);
    const params = new URLSearchParams({ variant: "C" });
    if (next !== "default") {
      params.set("state", next);
    }
    router.replace(`/prototype/field/${assignmentId}?${params.toString()}`, {
      scroll: false,
    });
  }

  return (
    <main className="pt-app pt-app--assignment">
      <a className="pt-skip-link" href="#assignment-content">
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <div className="pt-app-frame">
        <PrototypeHeader state={prototypeState} />
        <div className="pt-assignment-backbar">
          <Link href="/prototype/field?variant=A">
            <ArrowLeft aria-hidden="true" size={18} />
            กลับไปคิวงาน
          </Link>
          <span>โครงแนะนำ A → C</span>
        </div>
        <div id="assignment-content" className="pt-content" tabIndex={-1}>
          <StateBoundary state={prototypeState}>
            <AssignmentRoute
              assignmentId={assignmentId}
              prototypeState={prototypeState}
            />
            <QueuePeek currentId={assignmentId} />
          </StateBoundary>
        </div>
        <PrototypeBottomNav />
      </div>

      <aside aria-label="เครื่องมือทดสอบสถานะ" className="pt-prototype-tools">
        <StateLab current={prototypeState} onStateChange={changeState} />
        <p>หน้าจอหลักฐาน · ไม่มีแบบคำถามจริง</p>
      </aside>
    </main>
  );
}

function QueuePeek({ currentId }: { currentId: string }) {
  const remaining = priorityAssignments.filter(({ id }) => id !== currentId);
  return (
    <section aria-labelledby="queue-peek-title" className="pt-queue-peek">
      <div>
        <h2 id="queue-peek-title">คิวงานถัดไป</h2>
        <span>เหลืออีก {remaining.length} งาน</span>
      </div>
      <ul>
        {remaining.map((assignment) => (
          <li key={assignment.id}>
            <strong>{assignment.id}</strong>
            <span>{assignment.areaLabel}</span>
            <small>{assignment.statusLabel}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
