# T-008: แก้ alert ของ CodeQL และบันทึกว่า repo เป็น Public

## Ticket

- **Requirement:** FR-MEDIA-01 (ตรวจชนิดไฟล์จากเนื้อไฟล์), SEC และ M-SAST-01 (ไม่มี alert ระดับ high จาก SAST)
- **ที่มา:** ผู้ใช้เปลี่ยน repo เป็น Public วันที่ 2026-11-13 CodeQL จึงอัปโหลดผลได้ และ check `CodeQL` บน PR #1 ล้มด้วย alert ระดับ high 4 ข้อ
- **ปัญหา:**
  - **ReDoS:** `SVG_START` ใน `cms-api/src/modules/media/domain/services/media-types.ts:19` มีกลุ่ม `(?:<!--[\s\S]*?-->\s*)*`
    ซ้อนกันสองชุด ไฟล์ที่ขึ้นต้นด้วย `<!--` และมี `--><!--` ซ้ำยาว ทำให้ regex ย้อนรอยแบบทวีคูณ
    ทุกไฟล์ที่อัปโหลดผ่าน `detectMimeType` และ Node รัน thread เดียว ผู้ใช้ที่อัปโหลดได้จึงทำให้ API ค้างได้
    ส่วนที่อ่านถูกจำกัดไว้ที่ 4096 ไบต์ แต่ยังพอให้ค้างได้
  - **Test fake:** `FakeSvgSanitizer` ใน `cms-api/test/fakes/media.fakes.ts:244` ไม่จับ `<SCRIPT>` และลบ `<script>` ได้ครั้งเดียว
    เป็นโค้ดเทสต์ ไม่ได้ขึ้นระบบจริง แต่ CodeQL นับเป็น alert 2 ข้อ
  - **เอกสาร:** README ของ harness ยังเขียนว่า repo เป็น Private และ CodeQL อัปโหลดไม่ได้
- **Branch:** `feature/docs-demo-hook` ซึ่งเป็น head ของ PR #1 เพื่อให้ check `CodeQL` บน PR เดิมรันใหม่

## Contract

**สถานะ:** อนุมัติแล้ว

### ขอบเขต

1. **Red:** เพิ่มเทสต์ใน `media.domain.spec.ts` ที่ส่ง input อันตรายเข้า `detectMimeType` แล้วต้องคืนผลภายในเวลาที่กำหนด
   และเทสต์ของ fake ที่ใช้ `<SCRIPT>` และ `<script>` หลายชุด ต้องล้มก่อนแก้ทั้งคู่
2. **Green:** เปลี่ยนการตรวจ SVG เป็นการอ่านทีละส่วนตามลำดับ ข้าม XML declaration, comment และ doctype แล้วดูว่าเจอ `<svg`
   ใช้ `indexOf` แทน regex ที่ซ้อนกัน จึงทำงานตามความยาว input แบบเส้นตรง
   เทสต์เดิมของ SVG ทั้งหมดต้องยังผ่าน รวมกรณี BOM, comment ก่อนและหลัง doctype และ `<svgx>` ที่ต้องไม่นับเป็น SVG
3. **Fake:** ให้ `FakeSvgSanitizer` ลบ `<script` ทุกตัวโดยไม่สนตัวพิมพ์
4. **เอกสาร:** README ของ harness และ `docs/quality/gates.md` บันทึกว่า repo เป็น Public ตั้งแต่ 2026-11-13 CodeQL อัปโหลดผลได้ และผลของ T-008
5. Push ไปที่ PR #1 ซึ่ง hook จะถามคุณก่อน แล้วอ่านผล check `CodeQL`

### นอกขอบเขต

- ไม่แก้ตัว sanitizer จริงใน `adapters/out/image/` ซึ่งไม่มี alert
- ไม่ย้าย CodeQL Action จาก v3 ไป v4 เพราะไม่เกี่ยวกับ alert ทั้ง 4 ข้อ
- ไม่แก้ Mutation testing ที่ช้าบน runner
- ไม่ตัดสินเรื่องสเปก Internal ที่ตอนนี้เปิดเป็น Public ผู้ใช้ควรแจ้งหัวหน้าเอง
- ไม่ merge PR #1

### ไฟล์ที่แก้ได้

- `cms-api/src/modules/media/domain/services/media-types.ts`, `cms-api/src/modules/media/domain/media.domain.spec.ts`
- `cms-api/test/fakes/media.fakes.ts`, `cms-api/src/modules/media/application/use-cases/media.use-cases.spec.ts`
- `docs/harness/README.md`, `docs/quality/gates.md`
- `docs/harness/state.json` และไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [ ] มี commit `red` และ `green` และ Red แต่ละกรณีล้มแยกกัน
- [ ] เทสต์ ReDoS ผ่านภายใน 100 มิลลิวินาที และเทสต์ SVG เดิมผ่านทั้งหมด
- [ ] `pnpm gate` และ `pnpm gate:self-test` ผ่าน
- [ ] check `CodeQL` บน PR #1 ไม่มี alert ระดับ high เหลือ

### ความเสี่ยง

- **ตรวจ SVG ผิดไปจากเดิม:** ถ้าตัวตรวจใหม่ปล่อยไฟล์ที่ไม่ใช่ SVG ผ่าน หรือปฏิเสธ SVG ที่เคยผ่าน การอัปโหลดจะเสีย
  กันด้วยเทสต์เดิมทั้งหมด, mutation testing ตามเกณฑ์ M-TEST-07 ใน gate และ E2E-05 ที่อัปโหลดรูปจริง
- **เทสต์ที่วัดเวลาอาจไม่นิ่งบน CI:** ใช้ input ที่ regex เดิมใช้เวลาหลายวินาที ส่วนตัวใหม่ใช้ไม่ถึงมิลลิวินาที เผื่อห่างกันมาก
- **ช่องโหว่อยู่ใน repo Public ตั้งแต่เปลี่ยน:** ควรแก้เร็ว และ Demo ใช้แค่ในเครื่อง จึงไม่มีระบบจริงที่โดนโจมตีได้

### การอนุมัติ

- **ผู้อนุมัติ:** ผู้ใช้ ผ่านปุ่มในแอป Claude Code ("Approve T-008")
- **วันที่:** 2026-11-13

### การแก้ Contract

- **2026-11-13:** เทสต์ของ fake ย้ายจาก `cms-api/test/fakes/` ไปที่ `media.use-cases.spec.ts` เพราะ vitest รัน unit test เฉพาะ `src/**/*.spec.ts`
  ผู้ใช้เลือกทางนี้ก่อนเริ่ม Red

## Red

`vitest run --project unit` กับ spec ของ media ได้ 120 ผ่าน 3 ล้ม แต่ละกรณีล้มด้วย assertion ของตัวเอง:

```text
× reads comments in time that grows with the input, not exponentially   expected 2428.19 to be less than 100
× removes a script written in upper case                                 '<svg><SCRIPT>alert(1)</SCRIPT></svg>' still matches /<script/i
× removes every script, and keeps what lies between them                 expected '<svg></svg>' to contain '<g/>'
```

กรณีที่ตรวจว่าตัวใหม่อ่านเหมือน regex เดิม 6 กรณีผ่านอยู่แล้ว ผมรัน regex เดิมกับ input ทั้ง 6 เพื่อยืนยันคำตอบก่อนเขียน
ไม่มีโครงที่ throw เพราะเทสต์เรียกฟังก์ชันที่มีอยู่แล้ว
