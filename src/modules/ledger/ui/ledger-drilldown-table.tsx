"use client";

import { Trash2 } from "lucide-react";

import {
  formatMoney,
  formatQuantity,
  isPositiveDecimal,
} from "@/modules/farm-core/domain/decimal";
import type { ExpenseItem, SaleItem } from "../domain/ledger-model";
import styles from "./ledger.module.css";

export type UnifiedLedgerRow =
  | {
      type: "sale";
      id: string;
      date: string;
      farmName: string;
      plotCode: string | null;
      title: string;
      subDetail: string;
      amount: string;
      isDeleted: boolean;
      deleteReason: string | null;
      raw: SaleItem;
    }
  | {
      type: "expense";
      id: string;
      date: string;
      farmName: string;
      plotCode: string | null;
      title: string;
      subDetail: string;
      amount: string;
      isDeleted: boolean;
      deleteReason: string | null;
      raw: ExpenseItem;
    };

export type LedgerDrilldownTableProps = {
  expenses: ExpenseItem[];
  sales: SaleItem[];
  onDeleteExpense: (expense: ExpenseItem) => void;
  onDeleteSale: (sale: SaleItem) => void;
};

const thaiDateFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatThaiDate(value: string): string {
  return thaiDateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function LedgerDrilldownTable({
  expenses,
  sales,
  onDeleteExpense,
  onDeleteSale,
}: LedgerDrilldownTableProps) {
  // Merge and sort by date descending
  const rows: UnifiedLedgerRow[] = [
    ...sales.map((s) => ({
      type: "sale" as const,
      id: s.id,
      date: s.saleDate,
      farmName: s.farmName,
      plotCode: s.plotCode,
      title: `ขายผลผลิต ${s.buyerName ? `(${s.buyerName})` : ""}`,
      subDetail: `${formatQuantity(s.quantity)} ตัน @ ฿${formatMoney(s.unitPrice)}${
        isPositiveDecimal(s.deductions) ? ` (หัก ฿${formatMoney(s.deductions)})` : ""
      }`,
      amount: s.netAmount,
      isDeleted: s.isDeleted,
      deleteReason: s.deleteReason,
      raw: s,
    })),
    ...expenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      date: e.expenseDate,
      farmName: e.farmName,
      plotCode: e.plotCode,
      title: e.category,
      subDetail: e.notes || "-",
      amount: e.amount,
      isDeleted: e.isDeleted,
      deleteReason: e.deleteReason,
      raw: e,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (rows.length === 0) {
    return (
      <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
        ยังไม่มีรายการบัญชีในรอบเวลาที่เลือก
      </div>
    );
  }

  return (
    <div className={styles.tableWrap} tabIndex={0} aria-label="ตารางรายการบัญชีรายรับ-รายจ่าย">
      <table className={styles.ledgerTable}>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ประเภท</th>
            <th>สวน / แปลง</th>
            <th>รายการ / รายละเอียด</th>
            <th className={styles.numeric}>จำนวนเงินสุทธิ</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.type}-${row.id}`}
              className={row.isDeleted ? styles.rowDeleted : ""}
              data-testid={`ledger-row-${row.id}`}
            >
              <td data-label="วันที่">{formatThaiDate(row.date)}</td>
              <td data-label="ประเภท">
                {row.isDeleted ? (
                  <span className={`${styles.badge} ${styles.badgeDeleted}`} title={`เหตุผล: ${row.deleteReason || "-"}`}>
                    ยกเลิกแล้ว
                  </span>
                ) : row.type === "sale" ? (
                  <span className={`${styles.badge} ${styles.badgeSale}`}>+ รายรับ</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeExpense}`}>- รายจ่าย</span>
                )}
              </td>
              <td data-label="สวน / แปลง">
                <strong>{row.farmName}</strong>
                {row.plotCode && (
                  <span style={{ color: "var(--muted)", marginLeft: "6px" }}>({row.plotCode})</span>
                )}
              </td>
              <td data-label="รายการ / รายละเอียด">
                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{row.title}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                  {row.subDetail}
                  {row.isDeleted && row.deleteReason && (
                    <span style={{ color: "var(--rust)", marginLeft: "8px" }}>
                      (ลบเนื่องจาก: {row.deleteReason})
                    </span>
                  )}
                </div>
              </td>
              <td
                data-label="จำนวนเงินสุทธิ"
                className={styles.numeric}
                style={{
                  fontWeight: 700,
                  color: row.isDeleted
                    ? "var(--muted)"
                    : row.type === "sale"
                    ? "var(--success)"
                    : "var(--rust)",
                  textDecoration: row.isDeleted ? "line-through" : "none",
                }}
              >
                {row.type === "sale" ? "+" : "-"}฿{formatMoney(row.amount)}
              </td>
              <td data-label="การจัดการ" className={styles.actionCell}>
                {!row.isDeleted ? (
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => {
                      if (row.type === "sale") {
                        onDeleteSale(row.raw);
                      } else {
                        onDeleteExpense(row.raw);
                      }
                    }}
                    aria-label={`ลบรายการ ${row.title}`}
                    title="ลบรายการ"
                  >
                    <Trash2 size={18} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                ) : (
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
