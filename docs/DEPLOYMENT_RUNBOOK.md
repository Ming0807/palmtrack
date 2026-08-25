# Deployment runbook

เอกสารนี้เป็นแผนปฏิบัติหลัง review gate เท่านั้น ปัจจุบันไม่มี environment หรือ cloud resource

## Planned environments

| Environment | Data | Purpose | Boundary |
|---|---|---|---|
| local | synthetic only | development/unit/integration | local process + Supabase CLI state ignored |
| preview | synthetic only | PR UX/E2E | Vercel preview + isolated/non-production Supabase project เมื่อทรัพยากรอนุญาต |
| research | approved real data only after release gate | limited field collection | Vercel Hobby + Supabase Free private project |

ห้าม copy research data ลง local/preview หาก free quota ไม่พอสำหรับ isolated preview ให้ใช้ local synthetic stack ไม่ชี้ preview ไป research database

## Setup sequence (no secret values)

1. สร้าง GitHub repository protection/reviewer และเปิด secret scanning ที่มีให้; ไม่ commit provider credential
2. สร้าง Supabase project ใน region ที่ได้รับอนุมัติ บันทึก project/region/owner ใน private operations inventory
3. รัน reviewed schema migrations: extensions → tables/constraints → helper functions → RLS/grants → private buckets/policies → reporting views; ตรวจว่า public privilege ไม่มีเกินจำเป็น
4. สร้าง Vercel Hobby project เชื่อม reviewed branch ตั้ง framework Next.js และ environment variables ต่อ environment
5. ตั้ง Auth redirect allowlist ด้วย URL จริงจาก provider inventory ไม่ใส่ fake URL ใน source; ปิด signup ที่ไม่ต้องการและ provision role ผ่าน admin flow
6. สร้าง synthetic admin/role fixtures ใน non-research environment; research account ใช้ approved roster
7. รัน RLS/security/E2E/backup baseline แล้วบันทึก evidence ก่อนอนุญาต real data

Environment-variable **names only** ที่วางแผน: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `APP_WORKSPACE_ID`, `APP_TIME_ZONE`, `EXPORT_SIGNING_SECRET` ชื่อสุดท้ายต้อง review ตาม implementation และให้เฉพาะ server variable ไม่มี `NEXT_PUBLIC_` สำหรับ secret Local ใช้ ignored `.env.local`; provider UI เก็บค่าจริง

## Migration and deploy

1. Lock approved commit, backup current DB/storage ตาม procedure ด้านล่าง และ verify checksum/restore ล่าสุด
2. Dry-run migration กับ clone/clean synthetic target; review destructive/locking query และ backward compatibility
3. Apply additive/backward-compatible DB migration ด้วย least-privileged migration identity ตรวจ version/constraints/RLS tests
4. Deploy app version ที่รองรับ schema ทั้งก่อน/หลัง migration ตรวจ health, login ทุก role, critical write, withdrawal/export deny และ report reconciliation
5. Promote/enable behavior หลัง checks; บันทึก commit, migration IDs, actor, UTC time, evidence links ใน private operations log
6. Cleanup compatibility column เฉพาะ deployment ภายหลังเมื่อ evidence ว่า old app ไม่มี traffic และมี backup

## Rollback

Application regression: disable affected route/feature, redeploy last known good immutable artifact และตรวจว่า schema backward-compatible Migration failure ก่อน commit ให้ transaction rollback; หลัง commit ใช้ reviewed compensating migration ไม่ใช้ manual destructive SQL หาก data corruption/incorrect semantic write ให้หยุด writes, preserve audit, export forensic snapshot, ประเมิน restore/forward correction และขอ approval Data restore เป็น last-resort เพราะอาจสูญ transaction หลัง backup; document recovery point และ reconcile audit/files

## Zero-cost database backup and restore

Supabase Free **ไม่มี automatic backups ที่ทีมอ้างพึ่งได้** จึงทำ application-owned manual logical backup โดยไม่สัญญา provider guarantee:

1. ก่อนเริ่มข้อมูลจริงและอย่างน้อยหลังวันเก็บข้อมูล/ก่อน migration/export สำคัญ ผู้ดูแลที่ได้รับอนุมัติใช้ official PostgreSQL tooling compatible version เชื่อมผ่าน `SUPABASE_DB_URL` จาก secure environment
2. Export schema + app data ใน custom/logical format ที่ restore ได้ รวม migration table แต่ไม่พยายาม export provider-managed Auth password hash, session, token หรือ secret ซึ่ง **กู้คืนไม่ได้**
3. ใช้ authorized server/admin process สร้าง **encrypted identity manifest** ที่มีเฉพาะ stable app `user_profile.id`, normalized login identifier และ `identifier_type` (`email|phone`) ของ active accounts ห้ามมี password, password hash, OTP, session, refresh/access token หรือ provider key Normalization คือ trim; email ใช้ Unicode NFC แล้ว lowercase; phone ใช้ canonical E.164 ที่ผ่าน validation
4. สร้าง backup manifest: UTC time, project inventory ID, schema/migration version, tool version, table row counts, logical dump/identity/storage file names, SHA-256 และ operator ห้ามใส่ credential หรือ raw identifier ลง unencrypted outer manifest
5. เข้ารหัส logical backup และ identity manifest ด้วยเครื่องมือ/recipient ที่สถาบันอนุมัติ เก็บอย่างน้อยสองสำเนาที่ควบคุมการเข้าถึงและแยก failure domain ภายใต้พื้นที่ zero-cost ที่ได้รับอนุมัติ; ห้าม public link/repository
6. Restore drill ไป clean local/isolated target: apply migration/schema → restore app data โดยรักษา stable `user_profile.id` → ใช้ Supabase Auth Admin API สร้าง Auth user ใหม่ทีละ identity ด้วย temporary credential → transactionally replace `user_profile.auth_user_id` ด้วย Auth UID ใหม่และตั้ง `must_change_password=true` โดยไม่เปลี่ยน profile UUID/role/workspace
7. ผู้ใช้ email ได้ temporary credential ผ่านช่องทางที่สถาบันอนุมัติและต้องเปลี่ยนเมื่อ sign-in แรก ผู้ใช้ phone ต้องผ่าน **admin-assisted credential reset** ก่อนใช้งาน; ห้ามถือ provider session/OTP เดิมว่าใช้ต่อได้
8. Sign in recovered synthetic fixture อย่างน้อยหนึ่ง account ต่อ roleหลัง reset ตรวจว่า Auth UID ใหม่ resolve ไป stable profile UUID เดิม, role/workspace เดิม, allowed RLS path สำเร็จ และ cross-role/cross-owner path ถูก deny จากนั้นรัน count/FK/sampling-run status+digest/profit tests
9. บันทึกผล pass/fail, duration, checksum, Auth relink counts และ securely remove temporary plaintext/temporary credential หลังยืนยัน ไม่มีการกล่าวว่าการมีไฟล์เท่ากับกู้คืนได้จน clean-target sign-in/RLS drill ผ่าน

Bootstrap และ Auth relink ใช้ **out-of-band database recovery procedure เท่านั้น** ผู้ดำเนินการฐานข้อมูลที่ควบคุมต้องตรวจตัวตน/อำนาจของ active admin, ตั้ง verified JWT context และ explicit `SET ROLE palmtrack_recovery_executor` ภายใน transaction ที่บันทึกหลักฐาน Role นี้เป็น `NOLOGIN`, ไม่มี membership และไม่ grant ให้ `anon`, `authenticated`, `service_role` หรือ application route หากไม่มีสิทธิ์ database operator ที่อนุมัติให้หยุด recovery และส่งต่อผู้รับผิดชอบ ห้ามเพิ่ม HTTP endpoint หรือใช้ service-role key เป็นทางลัด

เมื่อไม่มีพื้นที่/เครื่อง/กุญแจที่อนุมัติ ให้หยุด collection ไม่ลด control เพื่อคงค่าใช้จ่ายศูนย์

## Zero-cost private storage backup and restore

1. List object metadata ที่ authorized API ให้ได้และสร้าง manifest ของ opaque path, aggregate reference, size, content type, checksum/version
2. ดาวน์โหลด object ผ่าน authenticated admin script ไป encrypted private destination; compare checksum และ log missing/orphan โดยไม่ log signed URL
3. เก็บ database backup กับ storage manifest ที่ point-in-time เดียวกันให้มากที่สุดและบันทึก skew
4. Restore database metadata จากนั้น upload object ไป **private** bucket ของ clean target ด้วย opaque path; ตรวจ checksum/count, orphan/missing และ RLS/signed access tests ก่อนเปิดผู้ใช้
5. หากไฟล์บางชนิดไม่มี checksum ให้คำนวณระหว่าง backup และบันทึก limitation; ห้ามรายงาน restore complete หากขาด object ที่ required

## Monitoring and operations

ใช้ zero-cost provider logs/usage dashboard ที่มีอยู่และ application health แบบไม่บันทึก PII ตรวจ auth error spike, RLS deny anomaly, failed submission, export/file event, quota, DB/storage usage, backup age/restore status และ deploy error ผู้ดูแลตรวจช่วงเก็บข้อมูลทุกวันทำการและก่อน/หลังภาคสนาม กำหนด channel/escalation ใน private roster ไม่ commit contact จริง

## Free-tier limitations

- ไม่มี SLA; outage, cold start, sleeping/paused project, build/runtime/database/storage/bandwidth quota และ policy ของ provider อาจเปลี่ยน
- Supabase Free ไม่มี automatic backup ที่ใช้เป็น recovery strategy ของโครงการ; manual verified backup จำเป็น
- Vercel Hobby เหมาะเฉพาะงานวิจัยนักศึกษาที่ไม่ใช่เชิงพาณิชย์ ต้องตรวจ terms/quota ปัจจุบันก่อน deploy และหยุด/ย้ายหาก usage เปลี่ยน
- GitHub/free services ไม่ทดแทน private data archive ห้ามเก็บ DB/file backup หรือ secret ใน repository
- Supabase Auth password hashes, OTPs, sessions และ tokens ไม่เป็นส่วนของ backup และกู้คืนไม่ได้ Clean-target recovery ต้องสร้าง identity ใหม่/relink profile และบังคับ credential reset ตาม procedure ข้างต้น
- หาก control ที่จำเป็นทำไม่ได้ใน zero-cost boundary ให้ลดช่วง collection/feature หรือขอทรัพยากรที่อนุมัติ ไม่อ้างความพร้อมใช้งานหรือความปลอดภัยที่ไม่ได้ทดสอบ
