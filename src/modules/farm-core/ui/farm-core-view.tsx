"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { formatArea } from "../domain/decimal";
import type { FarmSummary, PlotSummary } from "../domain/farm-model";
import { deleteFarmAction, deletePlotAction } from "../server/actions";
import { DeleteDialog } from "./delete-dialog";
import { FarmForm } from "./farm-form";
import { PlotForm } from "./plot-form";
import styles from "./farm-core.module.css";

export type FarmWithPlots = FarmSummary & {
  plots?: PlotSummary[];
};

export type FarmCoreViewProps = {
  farms: FarmWithPlots[];
  status: "ready" | "forbidden" | "error";
  errorMessage?: string;
};

export function FarmCoreView({ farms, status, errorMessage }: FarmCoreViewProps) {
  // Modals state
  const [isFarmFormOpen, setIsFarmFormOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<FarmSummary | null>(null);

  const [plotFormState, setPlotFormState] = useState<{
    isOpen: boolean;
    farmId: string;
    plot: PlotSummary | null;
  }>({ isOpen: false, farmId: "", plot: null });

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

  const handleOpenAddFarm = () => {
    setEditingFarm(null);
    setIsFarmFormOpen(true);
  };

  const handleOpenEditFarm = (farm: FarmSummary) => {
    setEditingFarm(farm);
    setIsFarmFormOpen(true);
  };

  const handleDeleteFarm = (farm: FarmSummary) => {
    setDeleteDialogState({
      isOpen: true,
      title: "ยืนยันการลบสวนปาล์ม",
      description: `สวน "${farm.name}"`,
      onConfirm: async (reason: string) => {
        const formData = new FormData();
        formData.append("farmId", farm.id);
        formData.append("reason", reason);
        const res = await deleteFarmAction({ status: "idle" }, formData);
        if (res.status === "success") {
          setFeedback({ type: "success", text: "ลบสวนสำเร็จ" });
        } else {
          throw new Error(res.error || res.message || "ไม่สามารถลบสวนได้");
        }
      },
    });
  };

  const handleOpenAddPlot = (farmId: string) => {
    setPlotFormState({ isOpen: true, farmId, plot: null });
  };

  const handleOpenEditPlot = (farmId: string, plot: PlotSummary) => {
    setPlotFormState({ isOpen: true, farmId, plot });
  };

  const handleDeletePlot = (plot: PlotSummary) => {
    setDeleteDialogState({
      isOpen: true,
      title: "ยืนยันการลบแปลงย่อย",
      description: `แปลง "${plot.code} - ${plot.name}"`,
      onConfirm: async (reason: string) => {
        const formData = new FormData();
        formData.append("plotId", plot.id);
        formData.append("reason", reason);
        const res = await deletePlotAction({ status: "idle" }, formData);
        if (res.status === "success") {
          setFeedback({ type: "success", text: "ลบแปลงสำเร็จ" });
        } else {
          throw new Error(res.error || res.message || "ไม่สามารถลบแปลงได้");
        }
      },
    });
  };

  if (status === "forbidden") {
    return (
      <div className={styles.container}>
        <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะบทบาทเกษตรกรเท่านั้น)
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.container}>
        <div className={`${styles.feedbackBanner} ${styles.feedbackError}`} role="alert">
          {errorMessage || "เกิดข้อผิดพลาดในการโหลดข้อมูลสวน"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>สวนปาล์มของฉัน</h1>
          <p className={styles.subtitle}>
            จัดการข้อมูลพื้นที่สวนและแปลงย่อยเพื่อใช้ในการบันทึกบัญชีและการบริหารจัดการ
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/garden-account" className={styles.secondaryButton}>
            ไปที่สมุดบัญชีสวน →
          </Link>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleOpenAddFarm}
            data-testid="add-farm-button"
          >
            + เพิ่มสวนปาล์ม
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

      {farms.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>ยังไม่มีข้อมูลสวนปาล์ม</h2>
          <p className={styles.emptyDescription}>
            เริ่มต้นโดยการเพิ่มข้อมูลสวนปาล์มแห่งแรกของคุณเพื่อบันทึกแปลง รายรับ และรายจ่าย
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleOpenAddFarm}
            data-testid="add-first-farm-button"
          >
            + เพิ่มสวนปาล์มแห่งแรก
          </button>
        </div>
      ) : (
        <div className={styles.farmGrid}>
          {farms.map((farm) => (
            <article key={farm.id} className={styles.farmCard} data-testid={`farm-card-${farm.id}`}>
              <div className={styles.farmHeader}>
                <div className={styles.farmTitleGroup}>
                  <h2 className={styles.farmName}>{farm.name}</h2>
                  {farm.locationLabel && (
                    <span className={styles.farmMeta}>
                      <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
                      {farm.locationLabel}
                    </span>
                  )}
                </div>
                <div className={styles.farmActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => handleOpenEditFarm(farm)}
                    aria-label={`แก้ไข ${farm.name}`}
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => handleDeleteFarm(farm)}
                    aria-label={`ลบ ${farm.name}`}
                  >
                    ลบ
                  </button>
                </div>
              </div>

              <div className={styles.farmBody}>
                <div className={styles.farmStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>พื้นที่รวมทั้งหมด</span>
                    <span className={styles.statValue}>{formatArea(farm.totalArea)} ไร่</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>จำนวนแปลงย่อย</span>
                    <span className={styles.statValue}>{farm.plotCount} แปลง</span>
                  </div>
                </div>

                <div className={styles.plotSection}>
                  <div className={styles.plotHeader}>
                    <h3 className={styles.plotTitle}>แปลงย่อยในสวน</h3>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => handleOpenAddPlot(farm.id)}
                      data-testid={`add-plot-btn-${farm.id}`}
                    >
                      <Plus size={16} strokeWidth={2} aria-hidden="true" />
                      เพิ่มแปลงย่อย
                    </button>
                  </div>

                  {farm.plots && farm.plots.length > 0 ? (
                    <div className={styles.plotList}>
                      {farm.plots.map((plot) => (
                        <div key={plot.id} className={styles.plotItem} data-testid={`plot-item-${plot.id}`}>
                          <div className={styles.plotInfo}>
                            <span className={styles.plotCode}>{plot.code}</span>
                            <span className={styles.plotName}>{plot.name}</span>
                            <span className={styles.plotArea}>({formatArea(plot.area)} ไร่)</span>
                          </div>
                          <div className={styles.plotActions}>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => handleOpenEditPlot(farm.id, plot)}
                              aria-label={`แก้ไขแปลง ${plot.code}`}
                              title="แก้ไขแปลง"
                            >
                              <Pencil size={17} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => handleDeletePlot(plot)}
                              aria-label={`ลบแปลง ${plot.code}`}
                              title="ลบแปลง"
                            >
                              <Trash2 size={17} strokeWidth={1.8} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.84rem" }}>
                      ยังไม่มีแปลงย่อย (สามารถเพิ่มแปลงย่อยเพื่อแยกบันทึกข้อมูลรายแปลงได้)
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Farm Form Modal */}
      {isFarmFormOpen && (
        <FarmForm
          isOpen={isFarmFormOpen}
          farm={editingFarm}
          onClose={() => setIsFarmFormOpen(false)}
          onSuccess={() => {
            setFeedback({
              type: "success",
              text: editingFarm ? "แก้ไขข้อมูลสวนสำเร็จ" : "บันทึกสวนใหม่สำเร็จ",
            });
          }}
        />
      )}

      {/* Plot Form Modal */}
      {plotFormState.isOpen && (
        <PlotForm
          isOpen={plotFormState.isOpen}
          farmId={plotFormState.farmId}
          plot={plotFormState.plot}
          onClose={() => setPlotFormState({ isOpen: false, farmId: "", plot: null })}
          onSuccess={() => {
            setFeedback({
              type: "success",
              text: plotFormState.plot ? "แก้ไขข้อมูลแปลงสำเร็จ" : "บันทึกแปลงใหม่สำเร็จ",
            });
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
