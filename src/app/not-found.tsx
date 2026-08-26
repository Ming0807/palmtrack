import { FileQuestion } from "lucide-react";
import Link from "next/link";

import styles from "./fallback-states.module.css";

export default function NotFound() {
  return (
    <main className={styles.fallbackContainer} aria-labelledby="not-found-title">
      <div className={styles.fallbackCard}>
        <div className={`${styles.iconWrap} ${styles.iconWrapWarning}`} aria-hidden="true">
          <FileQuestion size={28} strokeWidth={2.2} />
        </div>
        <h1 id="not-found-title" className={styles.title}>
          ไม่พบหน้าที่ต้องการ (404)
        </h1>
        <p className={styles.description}>
          หน้าที่คุณกำลังค้นหาไม่มีอยู่ ถูกย้าย หรือที่อยู่เว็บไซต์ไม่ถูกต้อง
        </p>
        <div className={styles.actions}>
          <Link href="/app" className={styles.primaryButton}>
            กลับสู่หน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
