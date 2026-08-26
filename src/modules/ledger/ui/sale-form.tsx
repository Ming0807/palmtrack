"use client";

import { useActionState, useEffect, useState } from "react";

import { formatMoney } from "@/modules/farm-core/domain/decimal";
import type { FarmSummary, PlotSummary } from "@/modules/farm-core/domain/farm-model";
import { calculateSale } from "../domain/sale-formula";
import { createSaleAction, type LedgerFormState } from "../server/actions";
import styles from "./ledger.module.css";

export type SaleFormProps = {
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

export function SaleForm({
  isOpen,
  farms,
  plotsByFarm,
  selectedFarmId,
  onClose,
  onSuccess,
}: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(createSaleAction, initialState);

  const defaultFarmId = selectedFarmId || farms[0]?.id || "";
  const [userSelectedFarmId, setUserSelectedFarmId] = useState<string | null>(null);
  const currentFarmId = userSelectedFarmId ?? defaultFarmId;

  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [deductions, setDeductions] = useState("0.00");

  useEffect(() => {
    if (state.status === "success") {
      onSuccess();
      onClose();
    }
  }, [state.status, onSuccess, onClose]);

  if (!isOpen) return null;

  const currentPlots = plotsByFarm[currentFarmId] || [];
  const calc = calculateSale(quantity || "0", unitPrice || "0", deductions || "0");

  const handleClose = () => {
    setUserSelectedFarmId(null);
    setQuantity("");
    setUnitPrice("");
    setDeductions("0.00");
    onClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-form-title"
      data-testid="sale-form-modal"
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 id="sale-form-title" className={styles.modalTitle}>
            บันทึกการขายผลผลิต
          </h3>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleClose}
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
                <label htmlFor="sale-farm-select">
                  สวนปาล์ม <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <select
                  id="sale-farm-select"
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
                <label htmlFor="sale-plot-select">แปลงย่อย (ไม่บังคับ)</label>
                <select id="sale-plot-select" name="plotId" disabled={isPending}>
                  <option value="">-- บันทึกรวมทั้งสวน --</option>
                  {currentPlots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="sale-date-input">
                  วันที่ขาย <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <input
                  id="sale-date-input"
                  name="saleDate"
                  type="date"
                  required
                  defaultValue={getTodayString()}
                  disabled={isPending}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="sale-buyer-input">ลานเท / ผู้รับซื้อ</label>
                <input
                  id="sale-buyer-input"
                  name="buyerName"
                  type="text"
                  maxLength={120}
                  placeholder="เช่น ลานเทสมบูรณ์"
                  disabled={isPending}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="sale-quantity-input">
                  ปริมาณผลผลิต (ตัน) <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <input
                  id="sale-quantity-input"
                  name="quantity"
                  type="text"
                  required
                  inputMode="decimal"
                  placeholder="เช่น 10.000"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="sale-unit-price-input">
                  ราคาต่อหน่วย (บาท/ตัน) <span style={{ color: "var(--rust)" }}>*</span>
                </label>
                <input
                  id="sale-unit-price-input"
                  name="unitPrice"
                  type="text"
                  required
                  inputMode="decimal"
                  placeholder="เช่น 1000.00 หรือ 5.10"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="sale-deductions-input">
                  ค่าหัก ณ ที่จ่าย / ค่าธรรมเนียมลานเท (บาท)
                </label>
                <input
                  id="sale-deductions-input"
                  name="deductions"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={deductions}
                  onChange={(e) => setDeductions(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Live Calculation Box */}
              <div className={`${styles.liveCalculationBox} ${styles.fullWidth}`}>
                <div className={styles.liveCalcRow}>
                  <span>มูลค่ารวม (คำนวณอัตโนมัติ: ปริมาณ × ราคา):</span>
                  <strong>฿{formatMoney(calc.grossAmount)}</strong>
                </div>
                <div className={styles.liveCalcRow}>
                  <span>หักค่าใช้จ่าย ณ ที่จ่าย:</span>
                  <span>- ฿{formatMoney(deductions || "0.00")}</span>
                </div>
                <div className={`${styles.liveCalcRow} ${styles.highlight}`}>
                  <span>รายรับสุทธิที่ได้รับจริง:</span>
                  <span>฿{formatMoney(calc.netAmount)}</span>
                </div>
                {!calc.isValid && calc.error && (
                  <p style={{ color: "var(--rust)", margin: "6px 0 0", fontSize: "0.8rem", fontWeight: 700 }}>
                    ⚠️ {calc.error}
                  </p>
                )}
              </div>

              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label htmlFor="sale-notes-input">บันทึกเพิ่มเติม</label>
                <textarea
                  id="sale-notes-input"
                  name="notes"
                  rows={2}
                  maxLength={500}
                  placeholder="เช่น เปอร์เซ็นต์น้ำมัน 18%, เกรดผลผลิต A"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleClose}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isPending || (!calc.isValid && Number(quantity) > 0)}
            >
              {isPending ? "กำลังบันทึก..." : "บันทึกการขาย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
