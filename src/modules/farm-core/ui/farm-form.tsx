"use client";

import { useActionState, useEffect } from "react";

import { createFarmAction, updateFarmAction, type FarmFormState } from "../server/actions";
import type { FarmSummary } from "../domain/farm-model";
import styles from "./farm-core.module.css";

export type FarmFormProps = {
  isOpen: boolean;
  farm?: FarmSummary | null;
  onClose: () => void;
  onSuccess: () => void;
};

const initialState: FarmFormState = { status: "idle" };

export function FarmForm({ isOpen, farm, onClose, onSuccess }: FarmFormProps) {
  const isEditing = Boolean(farm);
  const action = isEditing ? updateFarmAction : createFarmAction;
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
      aria-labelledby="farm-form-title"
      data-testid="farm-form-modal"
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="farm-form-title" className={styles.modalTitle}>
            {isEditing ? "แก้ไขข้อมูลสวนปาล์ม" : "เพิ่มสวนปาล์มใหม่"}
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
          {farm && <input type="hidden" name="farmId" value={farm.id} />}

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
              <label htmlFor="farm-name-input">
                ชื่อสวน <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <input
                id="farm-name-input"
                name="name"
                type="text"
                required
                maxLength={120}
                placeholder="เช่น สวนปาล์มสมหวัง"
                defaultValue={farm?.name ?? ""}
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="farm-location-input">ที่ตั้ง / ตำบล / อำเภอ</label>
              <input
                id="farm-location-input"
                name="locationLabel"
                type="text"
                maxLength={200}
                placeholder="เช่น ต.เขาต่อ อ.ปลายพระยา จ.กระบี่"
                defaultValue={farm?.locationLabel ?? ""}
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="farm-area-input">
                ขนาดพื้นที่รวม (ไร่) <span style={{ color: "var(--rust)" }}>*</span>
              </label>
              <input
                id="farm-area-input"
                name="totalArea"
                type="text"
                required
                inputMode="decimal"
                placeholder="เช่น 25.500"
                defaultValue={farm?.totalArea ?? ""}
                disabled={isPending}
              />
              <small className={styles.helperText}>ระบุตัวเลขทศนิยมไม่เกิน 3 ตำแหน่ง (เช่น 25.5 หรือ 25.500)</small>
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
              {isPending ? "กำลังบันทึก..." : isEditing ? "บันทึกการแก้ไข" : "บันทึกสวนใหม่"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
