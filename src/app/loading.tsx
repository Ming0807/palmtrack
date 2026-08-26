import { Loader2 } from "lucide-react";

import styles from "./fallback-states.module.css";

export default function Loading() {
  return (
    <main className={styles.fallbackContainer}>
      <div
        className={styles.fallbackCard}
        role="status"
        aria-live="polite"
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <Loader2 className={styles.spinner} size={28} strokeWidth={2.2} />
        </div>
        <h1 className={styles.title}>กำลังโหลดข้อมูล...</h1>
        <p className={styles.description}>
          ระบบกำลังเตรียมข้อมูล โปรดรอสักครู่
        </p>
      </div>
    </main>
  );
}
