"use client";

import { useState, useTransition } from "react";

import styles from "./farm-core.module.css";

export type DeleteDialogProps = {
  isOpen: boolean;
  title: string;
  itemDescription: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function DeleteDialog({
  isOpen,
  title,
  itemDescription,
  onClose,
  onConfirm,
}: DeleteDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("กรุณาระบุเหตุผลการลบอย่างน้อย 3 ตัวอักษร");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm(trimmed);
        setReason("");
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ");
      }
    });
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      data-testid="delete-dialog-modal"
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="delete-dialog-title" className={styles.modalTitle}>
            {title}
          </h3>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            disabled={isPending}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <p style={{ margin: "0 0 16px", color: "var(--ink)", fontSize: "0.9rem" }}>
              คุณต้องการลบ <strong>{itemDescription}</strong> หรือไม่? ข้อมูลจะถูกซ่อนและบันทึกประวัติการลบไว้
            </p>

            {error && (
              <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
                {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="delete-reason-input">
                เหตุผลการลบ <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <textarea
                id="delete-reason-input"
                name="reason"
                rows={3}
                required
                minLength={3}
                maxLength={500}
                placeholder="เช่น บันทึกข้อมูลซ้ำซ้อน, ยุบรวมแปลง หรือขายที่ดิน"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
              />
              <small className={styles.helperText}>ต้องระบุอย่างน้อย 3 ตัวอักษรเพื่อบันทึกประวัติตรวจสอบ (Audit Trail)</small>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className={styles.dangerButton}
              disabled={isPending || reason.trim().length < 3}
            >
              {isPending ? "กำลังลบ..." : "ยืนยันการลบ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
