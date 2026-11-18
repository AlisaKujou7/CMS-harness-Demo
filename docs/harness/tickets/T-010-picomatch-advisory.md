# T-010: ยกเว้น advisory ของ picomatch ชั่วคราวใน gate

## Ticket

- **Requirement:** ขั้น Dependency CVEs ของ gate (`pnpm audit --audit-level high`) ตาม 05-METRICS
- **ที่มา:** `pnpm gate` ระหว่าง T-009 วันที่ 2026-11-18 ล้มที่ขั้นนี้ขั้นเดียว
- **ปัญหา:**
  - Advisory [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) ระดับ high: `picomatch` ทุกเวอร์ชันถึง 4.0.7 เกิด ReDoS ได้จาก extglob ที่ซ้ำ
  - ยังไม่มีเวอร์ชันที่แก้ (Patched versions: None) จึงอัปเกรดหรือ override ไม่ได้
  - มากับเครื่องมือฝั่งพัฒนาเท่านั้น เช่น `@stoplight/spectral-cli`, `lint-staged` และเครื่องมือ build รวม 103 เส้นทาง
    `pnpm audit --prod --audit-level high` ไม่เจอ ระบบที่ขึ้นใช้งานจึงไม่มีโค้ดนี้
  - เครื่องมือเหล่านี้รับ glob จากไฟล์ตั้งค่าของ repo เอง ไม่ใช่จากผู้ใช้ภายนอก
  - ตราบใดที่ขั้นนี้ล้ม hook จะไม่ให้ commit ปกติเลย รวมถึง Handoff ของ T-009
- **Branch:** `feature/ci-hook-review-2` ต่อจาก T-009 เพราะ T-009 ปิดไม่ได้จนกว่าจะแก้ข้อนี้

## Contract

**สถานะ:** อนุมัติแล้ว

### ขอบเขต

1. ยกเว้นเฉพาะ `GHSA-fc5q-39xc-vjpf` ผ่าน `auditConfig.ignoreGhsas` ใน `pnpm-workspace.yaml` พร้อมคอมเมนต์บอกเหตุผล ADR และวันที่ต้องตรวจซ้ำ
   ถ้า pnpm 12 ไม่อ่านค่านี้จากไฟล์ จะใช้ `--ignore GHSA-fc5q-39xc-vjpf` ในคำสั่งของขั้น `audit` ใน `tools/gates/run-gate.mjs` แทน
   ซึ่งผมลองแล้วว่าใช้ได้: `pnpm audit --audit-level high --ignore GHSA-fc5q-39xc-vjpf` ได้ exit 0
2. ADR-0020 บันทึกการยกเว้น ขอบเขต และเงื่อนไขที่ต้องเอาออก
3. `docs/quality/gates.md` บันทึกว่ามีการยกเว้นหนึ่งรายการ และ `STATUS.md` เพิ่มงานค้าง "ตรวจ picomatch ซ้ำ 2026-12-18"
4. ยืนยันว่ายกเว้นแค่รายการนี้: high อื่นที่อาจเกิดขึ้นยังทำให้ขั้นนี้ล้ม

### นอกขอบเขต

- ไม่ยกเว้นทั้งหมดที่ยังไม่มีทางแก้ (`--ignore-unfixable`) เพราะจะซ่อน advisory ใหม่ในอนาคต
- ไม่เปลี่ยนขั้นนี้ให้ตรวจเฉพาะ dependency ที่ขึ้นระบบจริง เพราะทำให้ gate อ่อนลงถาวร
- ไม่ถอดหรือเปลี่ยนเครื่องมือที่ดึง `picomatch` มา
- ไม่สร้างขั้นใน gate ที่ล้มเองเมื่อถึงวันตรวจซ้ำ บันทึกไว้ใน STATUS แทน

### ไฟล์ที่แก้ได้

- `pnpm-workspace.yaml` หรือ `tools/gates/run-gate.mjs` อย่างใดอย่างหนึ่ง ตามข้อ 1
- `docs/adr/0020-picomatch-advisory.md` (ไฟล์ใหม่), `docs/quality/gates.md`
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [x] `pnpm audit --audit-level high` ที่ gate ใช้ผ่าน และยังรายงานว่ายกเว้น `GHSA-fc5q-39xc-vjpf` หนึ่งรายการ
- [x] `pnpm gate` ผ่านครบ
- [x] ADR-0020 และงานค้างใน STATUS มีวันตรวจซ้ำ

### Red และ Green

ไม่มี `red` และ `green` เพราะเป็นการตั้งค่า ไม่ใช่พฤติกรรมของโค้ด การพิสูจน์คือผลของ `pnpm audit` และ `pnpm gate`
จึงไม่ใส่ Ticket นี้ใน `state.json`

### ความเสี่ยง

- **การยกเว้นค้างไว้นานเกินไป:** ใส่วันตรวจซ้ำในไฟล์ตั้งค่า, ADR และ STATUS
- **ประเมินผลกระทบผิด:** ตรวจด้วย `pnpm audit --prod` แล้วว่าไม่มีในระบบที่ขึ้นใช้งาน และบันทึกคำสั่งนั้นใน ADR
- **การยกเว้นเป็นเรื่องของ Tech Lead:** บันทึกเป็น ADR-0020 สถานะรอรีวิว

### การอนุมัติ

- **ผู้อนุมัติ:** ผู้ใช้ ผ่านปุ่มในแอป Claude Code ("Approve T-010")
- **วันที่:** 2026-11-18
