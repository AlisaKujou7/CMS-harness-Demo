# T-002: ตัดสินใจเรื่อง Markdown fallback และโมดูล notifications

## Ticket

- **Requirement:** 01-Requirements §6.1 (Markdown fallback), 04-ARCH §4 (โมดูล `notifications`)
- **ปัญหา:** ตอนเทียบกับสเปก 9 ไฟล์พบสองจุดที่โค้ดต่างจากสเปกโดยไม่มีบันทึกใน ADR-0013
  - Editor ไม่มี Markdown fallback ทั้งที่ FR-CONTENT-15 ใน SRS ไม่ได้ระบุไว้
  - ไม่มีโมดูล `notifications` ตามผัง การส่งอีเมลอยู่ใน shared adapter
- **Branch:** `feature/docs-record-spec-gaps`

## Contract

**สถานะ:** รออนุมัติ

### ขอบเขต

บันทึกการตัดสินใจทั้งสองข้อใน ADR-0013 ตามที่ผู้อนุมัติเลือก

- **Markdown fallback:** เสนอให้ตัดออกจาก MVP เพราะ SRS ซึ่งละเอียดกว่าไม่ได้ระบุ และเพิ่มภายหลังได้
- **โมดูล `notifications`:** เสนอให้คงไว้ที่ shared adapter เพราะตอนนี้มีแค่การส่งอีเมล ซึ่งเป็นงานของ driven adapter

งานนี้แก้เอกสารเท่านั้น จึงไม่มีขั้น Red และ Green

### นอกขอบเขต

- การทำ Markdown fallback จริง ถ้าผู้อนุมัติเลือกทำ จะเปิดเป็น Ticket ใหม่
- การย้ายโค้ดอีเมล

### ไฟล์ที่แก้ได้

- `docs/adr/0013-spec-conflicts.md`
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [ ] ADR-0013 มีทั้งสองข้อ พร้อมเหตุผล
- [ ] ระบุว่ารอ Product Owner และ Tech Lead รีวิว เช่นเดียวกับข้ออื่นใน ADR นี้
- [ ] Hook อนุญาตให้ commit ได้ เนื่องจากแก้เฉพาะไฟล์ `.md` หลัง gate ล่าสุด

### ความเสี่ยง

การตัดฟีเจอร์เป็นเรื่องของ Product Owner การอนุมัติใน Ticket นี้จึงเป็นแค่การบันทึกทางเลือกสำหรับ Demo ไม่ใช่การยืนยันแทนเจ้าของสเปก

### การอนุมัติ

- **ผู้อนุมัติ:**
- **วันที่:**
- **ทางเลือก Markdown fallback:**
- **ทางเลือกโมดูล notifications:**
