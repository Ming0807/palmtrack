"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import styles from "./fallback-states.module.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundaryFallback({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log sanitized error to client console for debugging without exposing to UI
    console.error("PalmTrack runtime caught exception in boundary:", error);
  }, [error]);

  return (
    <main className={styles.fallbackContainer}>
      <div
        className={styles.fallbackCard}
        role="alert"
        aria-live="assertive"
      >
        <div className={`${styles.iconWrap} ${styles.iconWrapError}`} aria-hidden="true">
          <AlertTriangle size={28} strokeWidth={2.2} />
        </div>
        <h1 className={styles.title}>เกิดข้อผิดพลาดในการโหลดข้อมูล</h1>
        <p className={styles.description}>
          ระบบไม่สามารถแสดงผลหน้านี้ได้ในขณะนี้ โปรดลองใหม่อีกครั้ง หรือกลับสู่หน้าหลัก
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => reset()}
            className={styles.primaryButton}
          >
            ลองใหม่อีกครั้ง
          </button>
          <Link href="/app" className={styles.secondaryButton}>
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
