# T-004: แก้เอกสารตามรีวิว harness และวาง Memory Management

## Ticket

- **ที่มา:** รีวิว harness ภายนอก (2026-11-09) ข้อ 1–4 และ 10 ใน `STATUS.md` กับคำติของหัวหน้าเรื่อง Memory Management
- **ปัญหา:** README บอกว่าความจำอยู่ใน memory ของ Claude Code ซึ่งอยู่นอก repo, ยังบอกว่าไม่มี remote, T-002 อ้าง branch ที่ไม่มี,
  สถานะของ test-to-code ratio ล้าสมัย และ validator หาไฟล์ชื่อมาตรฐานไม่เจอ
- **Branch:** `feature/docs-harness-review`

## Contract

**สถานะ:** อนุมัติแล้ว

### ขอบเขต

1. README: เพิ่มหัวข้อความจำของ AI ระบุว่าแต่ละอย่างเก็บที่ไหน และให้ memory ของ Claude Code เป็นแค่ตัวช่วยบนเครื่องเดียว
2. `CLAUDE.md`: เพิ่มกฎว่าสิ่งที่หน้าต่างถัดไปหรือคนอื่นต้องใช้ ต้องอยู่ใน repo
3. แก้ข้อความเรื่อง remote, CI และ test-to-code ratio ให้ตรงความจริง
4. T-002: บันทึกว่า branch ที่วางแผนไม่ได้สร้าง และงานอยู่ที่ไหนจริง
5. เพิ่ม `progress.md` และ `feature_list.json` ที่รากเป็นไฟล์ชี้ไปที่ของจริง

### นอกขอบเขต

- ข้อ 5–8 และ `init.sh` ซึ่งแก้ hook หรือเพิ่มสคริปต์ จะอยู่ใน T-005
- ข้อ 9 การวัดพฤติกรรม AI ก่อนและหลัง
- Handoff ของ T-001 และ T-003 ที่บันทึกว่า ratio ถูกข้าม เพราะตรงกับความจริงในวันที่เขียน จึงไม่แก้ย้อนหลัง

### ไฟล์ที่แก้ได้

- `docs/harness/README.md`, `docs/harness/STATUS.md`, `docs/harness/tickets/T-002-record-spec-gaps.md`
- `CLAUDE.md`, `docs/quality/gates.md`
- `progress.md`, `feature_list.json` (ไฟล์ใหม่)
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [x] ทุกข้อในขอบเขตแก้แล้ว
- [x] `node tools/gates/check.mjs ratio` ผ่านจริงก่อนแก้ข้อความ
- [ ] `pnpm gate` ผ่าน เพราะ `feature_list.json` ไม่ใช่ไฟล์ `.md`

### ความเสี่ยง

ไฟล์ชี้ทางอาจถูกมองว่าเพิ่มคะแนน validator โดยไม่ได้เพิ่มความสามารถ จึงเขียนในไฟล์ชัดเจนว่าเป็นแค่ตัวชี้ และไม่คัดลอกข้อมูลซ้ำ

### การอนุมัติ

- **ผู้อนุมัติ:** ผู้ใช้ ผ่านแชตของ Claude Code ("แก้ตามที่จดไว้ได้เลย") ซึ่งอนุมัติรายการในตารางรีวิว ไม่ได้อ่าน Contract นี้ก่อนเริ่ม
- **วันที่:** 2026-11-11

งานนี้แก้เอกสาร จึงไม่มีขั้น Red และ Green
