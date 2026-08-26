"use client";

import { useActionState, useEffect, useState } from "react";

import type { FarmSummary, PlotSummary } from "@/modules/farm-core/domain/farm-model";
import { EXPENSE_CATEGORIES } from "../domain/ledger-model";
import { createExpenseAction, type LedgerFormState } from "../server/actions";
import styles from "./ledger.module.css";

export type ExpenseFormProps = {
  isOpen: boolean;
  farms: FarmSummary[];
  plotsByFarm: Record<string, PlotSummary[]>;
  selectedFarmId?: string;
  onClose: () => void;
  onSuccess: () => void;
};

const initialState: LedgerFormState = { status: "idle" };

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ExpenseForm({
  isOpen,
  farms,
  plotsByFarm,
  selectedFarmId,
  onClose,
  onSuccess,
}: ExpenseFormProps) {
  const [state, formAction, isPending] = useActionState(createExpenseAction, initialState);

  const defaultFarmId = selectedFarmId || farms[0]?.id || "";
  const [userSelectedFarmId, setUserSelectedFarmId] = useState<string | null>(null);
  const currentFarmId = userSelectedFarmId ?? defaultFarmId;

  useEffect(() => {
    if (state.status === "success") {
      onSuccess();
      onClose();
    }
  }, [state.status, onSuccess, onClose]);

  if (!isOpen) return null;

  const currentPlots = plotsByFarm[currentFarmId] || [];

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-form-title"
      data-testid="expense-form-modal"
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="expense-form-title" className={styles.modalTitle}>
            บันทึกรายจ่ายสวน
          </h3>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              setUserSelectedFarmId(null);
              onClose();
            }}
            aria-label="ปิดหน้าต่าง"
            disabled={isPending}
          >
            ✕
          </button>
        </div>

        <form action={formAction}>
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

            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="expense-farm-select">
                  สวนปาล์ม <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <select
                  id="expense-farm-select"
                  name="farmId"
                  required
                  value={currentFarmId}
                  onChange={(e) => setUserSelectedFarmId(e.target.value)}
                  disabled={isPending}
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="expense-plot-select">แปลงย่อย (ไม่บังคับ)</label>
                <select id="expense-plot-select" name="plotId" disabled={isPending}>
                  <option value="">-- บันทึกรวมทั้งสวน --</option>
                  {currentPlots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="expense-date-input">
                  วันที่จ่าย <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <input
                  id="expense-date-input"
                  name="expenseDate"
                  type="date"
                  required
                  defaultValue={getTodayString()}
                  disabled={isPending}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="expense-category-select">
                  หมวดหมู่ค่าใช้จ่าย <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <select id="expense-category-select" name="category" required disabled={isPending}>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="expense-amount-input">
                  จำนวนเงิน (บาท) <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <input
                  id="expense-amount-input"
                  name="amount"
                  type="text"
                  required
                  inputMode="decimal"
                  placeholder="เช่น 3000.25"
                  disabled={isPending}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="expense-notes-input">บันทึกเพิ่มเติม</label>
                <textarea
                  id="expense-notes-input"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="รายละเอียดใบเสร็จ หรือข้อความเตือนความจำ"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setUserSelectedFarmId(null);
                onClose();
              }}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isPending}>
              {isPending ? "กำลังบันทึก..." : "บันทึกรายจ่าย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
