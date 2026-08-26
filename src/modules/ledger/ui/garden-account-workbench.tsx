"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { DeleteDialog } from "@/modules/farm-core/ui/delete-dialog";
import type { FarmSummary, PlotSummary } from "@/modules/farm-core/domain/farm-model";
import type { CashLedgerSummary, ExpenseItem, SaleItem } from "../domain/ledger-model";
import { deleteExpenseAction, deleteSaleAction } from "../server/actions";
import { ExpenseForm } from "./expense-form";
import { LedgerDrilldownTable } from "./ledger-drilldown-table";
import { LedgerSummaryCards } from "./ledger-summary-cards";
import { SaleForm } from "./sale-form";
import styles from "./ledger.module.css";

export type GardenAccountWorkbenchProps = {
  summary: CashLedgerSummary;
  expenses: ExpenseItem[];
  sales: SaleItem[];
  farms: FarmSummary[];
  plotsByFarm: Record<string, PlotSummary[]>;
  selectedFarmId?: string;
  fromDate?: string;
  toDate?: string;
  status: "ready" | "forbidden" | "error";
  errorMessage?: string;
};

export function GardenAccountWorkbench({
  summary,
  expenses,
  sales,
  farms,
  plotsByFarm,
  selectedFarmId = "",
  fromDate = "",
  toDate = "",
  status,
  errorMessage,
}: GardenAccountWorkbenchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Modals state
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isSaleFormOpen, setIsSaleFormOpen] = useState(false);

  const [deleteDialogState, setDeleteDialogState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: (reason: string) => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: async () => {},
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const handleFilterChange = (updates: { farmId?: string; fromDate?: string; toDate?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.farmId !== undefined) {
      if (updates.farmId) params.set("farmId", updates.farmId);
      else params.delete("farmId");
    }
    if (updates.fromDate !== undefined) {
      if (updates.fromDate) params.set("fromDate", updates.fromDate);
      else params.delete("fromDate");
    }
    if (updates.toDate !== undefined) {
      if (updates.toDate) params.set("toDate", updates.toDate);
      else params.delete("toDate");
    }
    router.push(`/app/garden-account?${params.toString()}`);
  };

  const handleDeleteExpense = (expense: ExpenseItem) => {
    setDeleteDialogState({
      isOpen: true,
      title: "ยืนยันการลบรายการรายจ่าย",
      description: `รายจ่าย "${expense.category}" จำนวน ฿${expense.amount}`,
      onConfirm: async (reason: string) => {
        const formData = new FormData();
        formData.append("expenseId", expense.id);
        formData.append("reason", reason);
        const res = await deleteExpenseAction({ status: "idle" }, formData);
        if (res.status === "success") {
          setFeedback({ type: "success", text: "ลบรายการรายจ่ายสำเร็จ" });
        } else {
          throw new Error(res.error || res.message || "ไม่สามารถลบรายการได้");
        }
      },
    });
  };

  const handleDeleteSale = (sale: SaleItem) => {
    setDeleteDialogState({
      isOpen: true,
      title: "ยืนยันการลบรายการขาย",
      description: `การขายผลผลิต วันที่ ${sale.saleDate} จำนวน ฿${sale.netAmount}`,
      onConfirm: async (reason: string) => {
        const formData = new FormData();
        formData.append("saleId", sale.id);
        formData.append("reason", reason);
        const res = await deleteSaleAction({ status: "idle" }, formData);
        if (res.status === "success") {
          setFeedback({ type: "success", text: "ลบรายการขายสำเร็จ" });
        } else {
          throw new Error(res.error || res.message || "ไม่สามารถลบรายการได้");
        }
      },
    });
  };

  if (status === "forbidden") {
    return (
      <div className={styles.workbench}>
        <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะบทบาทเกษตรกรเท่านั้น)
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.workbench}>
        <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
          {errorMessage || "เกิดข้อผิดพลาดในการโหลดข้อมูลสมุดบัญชี"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.workbench}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>สมุดบัญชีสวน</h1>
          <p className={styles.subtitle}>
            บันทึกรายรับ-รายจ่ายเงินสด และวิเคราะห์กำไร/ขาดทุนจากการดำเนินงานสวนปาล์ม
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/gardens" className={styles.secondaryButton}>
            ← จัดการข้อมูลสวน
          </Link>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setIsExpenseFormOpen(true)}
            data-testid="record-expense-button"
            disabled={farms.length === 0}
          >
            - บันทึกรายจ่าย
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setIsSaleFormOpen(true)}
            data-testid="record-sale-button"
            disabled={farms.length === 0}
          >
            + บันทึกการขาย
          </button>
        </div>
      </header>

      {feedback && (
        <div
          className={`${styles.feedbackBanner} ${
            feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError
          }`}
          role="alert"
          data-testid="feedback-alert"
        >
          {feedback.text}
        </div>
      )}

      {/* Filter Toolbar */}
      <section className={styles.filterToolbar} aria-label="ตัวกรองช่วงเวลาและสวน">
        <div className={styles.filterGroup}>
          <label htmlFor="filter-farm-select">สวนปาล์ม:</label>
          <select
            id="filter-farm-select"
            value={selectedFarmId}
            onChange={(e) => handleFilterChange({ farmId: e.target.value })}
          >
            <option value="">-- ทุกสวน --</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filter-from-date">ตั้งแต่วันที่:</label>
          <input
            id="filter-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => handleFilterChange({ fromDate: e.target.value })}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="filter-to-date">ถึงวันที่:</label>
          <input
            id="filter-to-date"
            type="date"
            value={toDate}
            onChange={(e) => handleFilterChange({ toDate: e.target.value })}
          />
        </div>

        {(selectedFarmId || fromDate || toDate) && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => handleFilterChange({ farmId: "", fromDate: "", toDate: "" })}
            style={{ fontSize: "0.8rem", padding: "4px 8px" }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </section>

      {farms.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>ยังไม่มีข้อมูลสวนปาล์ม</h2>
          <p className={styles.emptyDescription}>
            คุณต้องสร้างข้อมูลสวนปาล์มก่อน จึงจะสามารถบันทึกรายรับและค่าใช้จ่ายได้
          </p>
          <Link href="/app/gardens" className={styles.primaryButton}>
            + ไปเพิ่มสวนปาล์ม
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <LedgerSummaryCards summary={summary} />

          {/* Drilldown Table Section */}
          <section className={styles.tableSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>รายการบันทึกรับ-จ่าย</h2>
              <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                แสดงรายการตามช่วงเวลาและสวนที่เลือก ({expenses.length + sales.length} รายการ)
              </span>
            </div>
            <LedgerDrilldownTable
              expenses={expenses}
              sales={sales}
              onDeleteExpense={handleDeleteExpense}
              onDeleteSale={handleDeleteSale}
            />
          </section>
        </>
      )}

      {/* Expense Form Modal */}
      {isExpenseFormOpen && (
        <ExpenseForm
          isOpen={isExpenseFormOpen}
          farms={farms}
          plotsByFarm={plotsByFarm}
          selectedFarmId={selectedFarmId}
          onClose={() => setIsExpenseFormOpen(false)}
          onSuccess={() => {
            setFeedback({ type: "success", text: "บันทึกรายจ่ายสำเร็จ" });
          }}
        />
      )}

      {/* Sale Form Modal */}
      {isSaleFormOpen && (
        <SaleForm
          isOpen={isSaleFormOpen}
          farms={farms}
          plotsByFarm={plotsByFarm}
          selectedFarmId={selectedFarmId}
          onClose={() => setIsSaleFormOpen(false)}
          onSuccess={() => {
            setFeedback({ type: "success", text: "บันทึกการขายสำเร็จ" });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteDialogState.isOpen && (
        <DeleteDialog
          isOpen={deleteDialogState.isOpen}
          title={deleteDialogState.title}
          itemDescription={deleteDialogState.description}
          onClose={() => setDeleteDialogState((s) => ({ ...s, isOpen: false }))}
          onConfirm={deleteDialogState.onConfirm}
        />
      )}
    </div>
  );
}
