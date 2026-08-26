"use client";

import { useActionState, useEffect } from "react";

import { createPlotAction, updatePlotAction, type FarmFormState } from "../server/actions";
import type { PlotSummary } from "../domain/farm-model";
import styles from "./farm-core.module.css";

export type PlotFormProps = {
  isOpen: boolean;
  farmId: string;
  plot?: PlotSummary | null;
  onClose: () => void;
  onSuccess: () => void;
};

const initialState: FarmFormState = { status: "idle" };

export function PlotForm({ isOpen, farmId, plot, onClose, onSuccess }: PlotFormProps) {
  const isEditing = Boolean(plot);
  const action = isEditing ? updatePlotAction : createPlotAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      onSuccess();
      onClose();
    }
  }, [state.status, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plot-form-title"
      data-testid="plot-form-modal"
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="plot-form-title" className={styles.modalTitle}>
            {isEditing ? "แก้ไขข้อมูลแปลง" : "เพิ่มแปลงย่อย"}
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

        <form action={formAction}>
          <input type="hidden" name="farmId" value={farmId} />
          {plot && <input type="hidden" name="plotId" value={plot.id} />}

          <div className={styles.modalBody}>
            {state.status === "validation_error" && (
              <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
                {state.error}
              </div>
            )}
            {state.status === "error" && (
              <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
                {state.message}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="plot-code-input">
                รหัสแปลง <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <input
                id="plot-code-input"
                name="code"
                type="text"
                required
                maxLength={40}
                placeholder="เช่น P-01, แปลง 1"
                defaultValue={plot?.code ?? ""}
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="plot-name-input">
                ชื่อแปลง <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <input
                id="plot-name-input"
                name="name"
                type="text"
                required
                maxLength={120}
                placeholder="เช่น แปลงต้นน้ำ, แปลงติดถนน"
                defaultValue={plot?.name ?? ""}
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="plot-area-input">
                ขนาดพื้นที่แปลง (ไร่) <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <input
                id="plot-area-input"
                name="area"
                type="text"
                required
                inputMode="decimal"
                placeholder="เช่น 12.000"
                defaultValue={plot?.area ?? ""}
                disabled={isPending}
              />
              <small className={styles.helperText}>ระบุตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง</small>
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
            <button type="submit" className={styles.primaryButton} disabled={isPending}>
              {isPending ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "บันทึกแปลง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
