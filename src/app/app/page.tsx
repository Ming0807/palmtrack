import styles from "./app-shell.module.css";

export default function ApplicationHomePage() {
  return (
    <section className={styles.content}>
      <p className={styles.eyebrow}>Safety Skeleton</p>
      <h1>พื้นที่ทำงาน PalmTrack</h1>
      <p className={styles.lead}>ระบบยืนยันตัวตนและสิทธิ์ตามบทบาทพร้อมเป็นฐานสำหรับโมดูลวิจัยและบัญชีสวน โดยยังไม่เปิดรับข้อมูลจริงในระยะนี้</p>
      <div className={styles.notice}>
        <h2>ขอบเขตที่เปิดใช้งาน</h2>
        <p>เลือกเมนูที่ได้รับสิทธิ์เพื่อดูสถานะของแต่ละโมดูล ระบบจะตรวจสิทธิ์ซ้ำที่ฝั่งเซิร์ฟเวอร์ทุกเส้นทาง</p>
      </div>
    </section>
  );
}
