# T-001: Request log ของ API

## Ticket

- **Requirement:** NFR-OBS-01, SEC-14
- **ปัญหา:** API ไม่ได้บันทึก log ต่อ request ตอนนี้มีเฉพาะ access log ของ nginx ที่มี request id และเวลาตอบ แต่ไม่มี user id ส่วน NFR-OBS-01 ต้องการ request id, user id และ latency
- **Branch:** `feature/shared-request-log`

## Contract

**สถานะ:** อนุมัติแล้ว

### ขอบเขต

เพิ่ม middleware ที่เขียน log แบบ JSON หนึ่งรายการเมื่อตอบ request เสร็จ มีฟิลด์ `request_id`, `method`, `path`, `status`, `duration_ms` และ `user_id` เมื่อผู้เรียกเข้าสู่ระบบแล้ว

### นอกขอบเขต

- Metrics, tracing และ Sentry (NFR-OBS-02..04)
- Log ของ worker
- การส่ง log ออกนอกเครื่อง

### ไฟล์ที่แก้ได้

- `cms-api/src/shared/adapters/http/request-log.ts` (ไฟล์ใหม่)
- `cms-api/src/shared/adapters/http/request-log.spec.ts` (ไฟล์ใหม่)
- `cms-api/src/shared/adapters/http/configure-app.ts`
- `docs/quality/gates.md`
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [ ] ทุก request ได้ log หนึ่งรายการที่มีครบทุกฟิลด์ และ `request_id` ตรงกับ header `X-Request-Id`
- [ ] Request ที่เข้าสู่ระบบแล้วมี `user_id` ส่วน request ที่ไม่เข้าสู่ระบบไม่มี
- [ ] `path` ไม่มี query string เพราะอาจมีข้อมูลอ่อนไหว
- [ ] ไม่บันทึก email, IP, API key หรือ token (SEC-14)
- [ ] `/healthz` และ `/readyz` ไม่ถูกบันทึก เพราะ health check เรียกทุกไม่กี่วินาที
- [ ] ตรวจบน Compose stack แล้วเห็น log จริงจาก `cms-api`
- [ ] `pnpm gate` ผ่าน

### ความเสี่ยง

- **ข้อมูลอ่อนไหวรั่วใน log:** ใช้รายการฟิลด์ที่กำหนดไว้เท่านั้น และมีเทสต์ยืนยันว่าไม่มี query string
- **log เยอะเกิน:** ข้าม health check และ production จำกัดขนาด log ไว้แล้ว
- **`user_id` ไม่มีเมื่ออ่านเร็วเกิน:** เขียน log ตอน response จบ ซึ่ง guard ตั้งค่า `request.actor` ไปแล้ว

### การอนุมัติ

- **ผู้อนุมัติ:** ผู้ใช้ ผ่านแชตของ Claude Code ("อนุมัติทั้งคู่")
- **วันที่:** 2026-11-03

## Red

รัน `npx vitest run --project unit src/shared/adapters/http/request-log.spec.ts` ก่อนเขียนโค้ด:

```text
× records the request, and matches the id the client received
× names the signed-in user
× holds only the agreed fields, so no email, IP, key or token can reach it
× leaves out the query string, which can hold anything
× records a route that does not exist
× skips /healthz, which health checks call constantly
× skips /readyz, which health checks call constantly
AssertionError: expected [] to have a length of 1 but got +0
Tests  7 failed (7)
```

ล้มถูกเหตุผล เพราะ API ยังไม่เขียน log ส่วน `tsc --noEmit` ผ่าน เทสต์จึงไม่ได้ล้มเพราะ compile ไม่ได้
