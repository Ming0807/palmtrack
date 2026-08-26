import { formatMoney } from "@/modules/farm-core/domain/decimal";
import type { CashLedgerSummary } from "../domain/ledger-model";
import styles from "./ledger.module.css";

export type LedgerSummaryCardsProps = {
  summary: CashLedgerSummary;
};

export function LedgerSummaryCards({ summary }: LedgerSummaryCardsProps) {
  const isProfit = Number(summary.cashResult) >= 0;

  return (
    <div className={styles.summaryGrid} data-testid="ledger-summary-cards">
      {/* Net Income */}
      <div className={styles.summaryCard} data-testid="net-income-card">
        <div className={styles.summaryCardHeader}>
          <span className={styles.cardLabel}>รายรับสุทธิ (จากการขาย)</span>
          <span className={styles.cardIcon}>💰</span>
        </div>
        <p className={styles.cardAmount}>฿{formatMoney(summary.netIncome)}</p>
        <p className={styles.cardMeta}>จากรายการขาย {summary.saleCount} รายการ</p>
      </div>

      {/* Expense Total */}
      <div className={styles.summaryCard} data-testid="expense-total-card">
        <div className={styles.summaryCardHeader}>
          <span className={styles.cardLabel}>รายจ่ายทั้งหมด</span>
          <span className={styles.cardIcon}>💸</span>
        </div>
        <p className={styles.cardAmount}>฿{formatMoney(summary.expenseTotal)}</p>
        <p className={styles.cardMeta}>จากรายการจ่าย {summary.expenseCount} รายการ</p>
      </div>

      {/* Cash Profit / Loss */}
      <div className={styles.summaryCard} data-testid="cash-result-card">
        <div className={styles.summaryCardHeader}>
          <span className={styles.cardLabel}>ผลลัพธ์เงินสดสุทธิ (กำไร/ขาดทุน)</span>
          <span className={styles.cardIcon}>{isProfit ? "📈" : "📉"}</span>
        </div>
        <p
          className={`${styles.cardAmount} ${
            isProfit ? styles.profitPositive : styles.profitNegative
          }`}
        >
          {isProfit ? "+" : ""}฿{formatMoney(summary.cashResult)}
        </p>
        <p className={styles.cardMeta}>
          {summary.hasRecords ? (isProfit ? "กำไรสุทธิในรอบนี้" : "ขาดทุนสุทธิในรอบนี้") : "ยังไม่มีรายการบันทึก"}
        </p>
      </div>
    </div>
  );
}
