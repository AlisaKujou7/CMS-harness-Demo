# สถานะงาน

จุดเริ่มต้นของทุกหน้าต่างทำงานใหม่ อัปเดตทุกครั้งที่จบ Handoff แล้วตรวจเทียบกับ `git log` เสมอ

## ตอนนี้

| Ticket                                             | งาน                                       | สถานะ            |
| -------------------------------------------------- | ----------------------------------------- | ---------------- |
| [T-001](tickets/T-001-request-log.md)              | Request log ของ API                       | เสร็จ ดู Handoff |
| [T-002](tickets/T-002-record-spec-gaps.md)         | ตัดสินใจเรื่อง Markdown และ notifications | เสร็จ ดู Handoff |
| [T-003](tickets/T-003-requirement-traceability.md) | Requirement Traceability gate สำหรับ FR   | เสร็จ ดู Handoff |

## งานก่อนมีเวิร์กโฟลว์นี้

เฟส 0–8 เสร็จก่อนมี Ticket และ Handoff จึงไม่มีเอกสารเหล่านี้และไม่ได้สร้างย้อนหลัง ดูจาก `git log`, `docs/adr/` และ `docs/quality/gates.md`

## งานที่รู้ว่ายังค้าง

| งาน | อ้างอิง | สถานะ |
| --- | ------- | ----- |

| รายงานเข้าเล่มสหกิจ | - | พักไว้ตามที่ผู้ใช้สั่ง |
| Metrics, alert และ error tracking | NFR-OBS-02..04 | นอกขอบเขต Demo |
| Load test และ security review | NFR-PERF, SEC-15 | นอกขอบเขต Demo |
| ยืนยัน license ของ image `cms-migrate` | ADR-0013 | รอ Tech Lead |
