# T-007: แก้สิทธิ์ของ CI ที่ล้มในการรันครั้งแรกบน GitHub

## Ticket

- **ที่มา:** PR #1 (<https://github.com/AlisaKujou7/CMS-harness-Demo/pull/1>) รัน CI ครั้งแรกบน GitHub วันที่ 2026-11-13
- **ปัญหา:** งานที่ตรวจโค้ดผ่านทั้งหมด แต่ล้ม 3 งานจากการตั้งค่า:
  - **Security and licenses:** `gitleaks-action` อ่านรายการ commit ของ PR ไม่ได้ (`Resource not accessible by integration`)
    เพราะ `pr-gate.yml` ให้แค่ `contents: read`
  - **CodeQL (analyze):** วิเคราะห์เสร็จแต่ล้มตอนอ่านข้อมูล workflow run ด้วย error เดียวกัน เพราะไม่มี `actions: read`
  - **Conventional PR title:** ชื่อ PR เป็นค่าเริ่มต้น แก้ชื่อแล้ว แต่ check ไม่รันใหม่ เพราะ workflow ไม่ฟังเหตุการณ์ `edited`
- **Branch:** `feature/docs-demo-hook` ซึ่งเป็น head ของ PR #1 เพื่อให้ CI รันใหม่บน PR เดิม

## Contract

**สถานะ:** อนุมัติแล้ว

### ขอบเขต

1. `pr-gate.yml`: ให้ job `Security and licenses` มีสิทธิ์ `pull-requests: read` เฉพาะ job นั้น
2. `codeql.yml`: เพิ่ม `actions: read` ตามที่ `github/codeql-action` ต้องการ
3. ย้าย job `Conventional PR title` ไปเป็น workflow ของตัวเอง `pr-title.yml` ที่รันเมื่อ PR ถูกเปิด แก้ชื่อ push หรือเปิดใหม่
   เพื่อให้แก้ชื่อแล้วตรวจใหม่ทันที โดยไม่ต้องรันทั้ง PR Gate ซ้ำ
4. อัปเดต `docs/quality/gates.md` และ README ของ harness เรื่องสถานะ CI ตามผลจริงหลังรันใหม่
5. Push ไปที่ branch ของ PR #1 ซึ่ง hook จะถามคุณก่อน แล้วอ่านผล CI รอบใหม่

### นอกขอบเขต

- ไม่เปิด GitHub Code Security หรือบริการที่เสียเงิน ถ้า CodeQL ยังอัปโหลดผลไม่ได้เพราะ repo เป็น Private จะบันทึกเป็นข้อจำกัด
- ไม่ตั้ง branch protection หรือ required checks
- ไม่แก้ `release-images.yml` ซึ่งยังไม่เคยรัน
- ไม่ merge PR #1

### ไฟล์ที่แก้ได้

- `.github/workflows/pr-gate.yml`, `.github/workflows/codeql.yml`, `.github/workflows/pr-title.yml` (ไฟล์ใหม่)
- `docs/quality/gates.md`, `docs/harness/README.md`
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [x] `pnpm gate` ผ่านในเครื่องก่อน commit
- [x] บน PR #1 งาน `Security and licenses` และ `Conventional PR title` ผ่าน
- [x] CodeQL ผ่าน หรือถ้ายังล้ม มีสาเหตุจาก log ที่บันทึกไว้
- [x] Handoff บันทึกผล CI ทุกงานจากรอบใหม่

### Red และ Green

ไม่มี `red` และ `green` เพราะสิทธิ์ของ workflow ทดสอบในเครื่องไม่ได้ การพิสูจน์คือ CI รอบใหม่บน GitHub
จึงไม่ใส่ Ticket นี้ใน `state.json` ซึ่ง hook ใช้เฉพาะ `red` และ `green`

### ความเสี่ยง

- **ให้สิทธิ์เกินจำเป็น:** ให้เฉพาะสิทธิ์อ่าน และให้ระดับ job ไม่ใช่ทั้ง workflow
- **CodeQL บน repo Private:** อาจต้องใช้บริการเสียเงิน ซึ่งอยู่นอกขอบเขต
- **การเปลี่ยน CI เป็นเรื่องของ Tech Lead:** งานนี้ไม่เปลี่ยนกฎของ gate แค่ทำให้งานที่มีอยู่รันได้ จึงไม่เขียน ADR ใหม่

### การอนุมัติ

- **ผู้อนุมัติ:** ผู้ใช้ ผ่านปุ่มในแอป Claude Code ("Approve T-007")
- **วันที่:** 2026-11-13
