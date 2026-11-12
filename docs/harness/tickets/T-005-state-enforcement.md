# T-005: State Management ของเวิร์กโฟลว์

## Ticket

- **ที่มา:** รีวิว harness ภายนอก (2026-11-09) ข้อ 5–8 และ 10 (`init.sh`) ใน `STATUS.md` กับคำติของหัวหน้าเรื่อง State Management
- **ปัญหา:** สถานะของ Ticket อยู่ในข้อความที่ hook อ่านไม่ได้ จึงตรวจไม่ได้ว่า Contract อนุมัติแล้ว หรือ Green แก้เกินขอบเขต
  Red ของ T-003 ล้มทั้งไฟล์แทนทีละกรณี และไม่มีคำสั่งเดียวสำหรับเริ่มหน้าต่างใหม่
- **Branch:** `feature/ci-workflow-state`

## Contract

**สถานะ:** รออนุมัติ

### ขอบเขต

1. **สถานะของ Ticket ที่เครื่องอ่านได้:** เพิ่มไฟล์ `docs/harness/state.json` บอก Ticket ที่กำลังทำ, ขั้นปัจจุบัน, วันที่อนุมัติ และไฟล์ที่แก้ได้
2. **Hook ตรวจการอนุมัติ:** commit `red` ไม่ผ่านถ้า Ticket ปัจจุบันยังไม่มีวันที่อนุมัติ
3. **Hook ตรวจขอบเขต:** commit `green` ไม่ผ่านถ้าแก้ไฟล์ที่ไม่อยู่ในรายการของ Contract
4. **Red แยกทีละกรณี:** เพิ่มกฎใน `workflow.md` ว่า Red ต้องมีโครงที่ throw เพื่อให้แต่ละเทสต์ล้มด้วยเหตุผลของตัวเอง
5. **`init.sh`:** คำสั่งเดียวสำหรับเริ่มหน้าต่างใหม่ ติดตั้ง dependency, แสดง `STATUS.md` กับ `state.json` เทียบกับ `git log` แล้วรัน `gate:fast`
6. ADR สำหรับการเปลี่ยน gate และเพิ่มกรณีใน `gate:self-test`

### นอกขอบเขต

- ข้อ 9 การวัดพฤติกรรม AI ก่อนและหลังมี harness
- การบังคับว่าเทสต์ใน Red ล้มจริง ซึ่งต้องรันเทสต์ใน hook และช้าเกินไป

### ไฟล์ที่แก้ได้

- `tools/gates/git-guard.mjs`, `tools/gates/git-guard.test.mjs`, `.claude/hooks/guard-git.mjs`
- `tools/gates/self-test.mjs`
- `docs/harness/state.json` (ไฟล์ใหม่), `init.sh` (ไฟล์ใหม่)
- `docs/harness/workflow.md`, `docs/harness/README.md`, `docs/harness/templates/ticket.md`
- `docs/adr/0018-workflow-state-in-the-hook.md` (ไฟล์ใหม่), `docs/quality/gates.md`, `CLAUDE.md`
- ไฟล์ใน `docs/harness/` ของงานนี้

### Definition of Done

- [ ] มี commit `red` และ `green` โดย Red ใช้กฎแยกทีละกรณีเอง
- [ ] Hook ปฏิเสธ `red` เมื่อยังไม่อนุมัติ และปฏิเสธ `green` ที่แก้นอกขอบเขต ทดสอบทั้งด้วยเทสต์และการลองจริง
- [ ] `init.sh` รันได้ใน Git Bash บนเครื่องนี้
- [ ] `pnpm gate` และ `pnpm gate:self-test` ผ่าน

### ความเสี่ยง

- **`state.json` แก้เองได้:** AI ใส่วันที่อนุมัติเองได้ hook จึงพิสูจน์แค่ว่ามีการบันทึก ไม่ใช่ว่าคนอนุมัติจริง ต้องระบุใน ADR
- **งานทุกชิ้นต้องอัปเดต `state.json`:** เพิ่มขั้นตอน ถ้าลืม hook จะปฏิเสธ ซึ่งเป็นสิ่งที่ต้องการ แต่อาจสะดุดตอนแรก
- **การเปลี่ยน gate เป็นเรื่องของ Tech Lead:** บันทึกเป็น ADR สถานะรอรีวิว

### การอนุมัติ

- **ผู้อนุมัติ:**
- **วันที่:**
