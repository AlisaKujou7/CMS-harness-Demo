# สถานะงาน

จุดเริ่มต้นของทุกหน้าต่างทำงานใหม่ อัปเดตทุกครั้งที่จบ Handoff แล้วตรวจเทียบกับ `git log` เสมอ

## ตอนนี้

| Ticket                                             | งาน                                        | สถานะ            |
| -------------------------------------------------- | ------------------------------------------ | ---------------- |
| [T-001](tickets/T-001-request-log.md)              | Request log ของ API                        | เสร็จ ดู Handoff |
| [T-002](tickets/T-002-record-spec-gaps.md)         | ตัดสินใจเรื่อง Markdown และ notifications  | เสร็จ ดู Handoff |
| [T-003](tickets/T-003-requirement-traceability.md) | Requirement Traceability gate สำหรับ FR    | เสร็จ ดู Handoff |
| [T-004](tickets/T-004-review-fixes-docs.md)        | แก้เอกสารตามรีวิว และวาง Memory Management | เสร็จ ดู Handoff |
| [T-005](tickets/T-005-state-enforcement.md)        | State Management ของเวิร์กโฟลว์            | เสร็จ ดู Handoff |
| [T-006](tickets/T-006-demo-hook-scenes.md)         | ฉากที่ hook ปฏิเสธ AI ในคู่มือ Demo        | เสร็จ ดู Handoff |
| [T-007](tickets/T-007-ci-permissions.md)           | แก้สิทธิ์ของ CI ที่ล้มในการรันครั้งแรก     | เสร็จ ดู Handoff |

## งานก่อนมีเวิร์กโฟลว์นี้

เฟส 0–8 เสร็จก่อนมี Ticket และ Handoff จึงไม่มีเอกสารเหล่านี้และไม่ได้สร้างย้อนหลัง ดูจาก `git log`, `docs/adr/` และ `docs/quality/gates.md`

## งานที่รู้ว่ายังค้าง

หัวหน้างานแจ้งว่า Harness ยังขาดเรื่อง State Management และ Memory Management (2026-11-09) วางแล้วใน T-004 และ T-005 รอหัวหน้างานดูอีกครั้ง

### จากรีวิว harness (2026-11-09, commit `96d96f1`)

รีวิวจากภายนอกที่ <https://claude.ai/artifact/JiabHnoofiVj57XFW24kz5> เรียงตามลำดับที่เสนอ:

| ลำดับ | งาน                                                                                                                                                                           | ประเภท                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1     | README บอกว่า memory อยู่ใน Claude Code แต่ memory อยู่นอก repo คนอื่นไม่เห็น ต้องย้ายสถานะหรือเขียนให้ตรง                                                                    | Memory, เสร็จใน T-004            |
| 2     | README ยังบอกว่าไม่มี remote และ CI ไม่เคยรัน ทั้งที่มี GitHub แล้ว                                                                                                           | เอกสาร, เสร็จใน T-004            |
| 3     | T-002 อ้าง branch `feature/docs-record-spec-gaps` ที่ไม่มีอยู่จริง                                                                                                            | เอกสาร, เสร็จใน T-004            |
| 4     | Test-to-code ratio อาจผ่านแล้วเพราะมี `origin/main` ต้องตรวจ แล้วแก้ T-003 และ README                                                                                         | ตรวจก่อน, เสร็จใน T-004          |
| 5     | Red ต้องมี stub ที่ throw เพื่อให้แต่ละเทสต์ล้มแยกกัน                                                                                                                         | State, เสร็จใน T-005             |
| 6     | คำสั่งเดียวสำหรับเริ่มหน้าต่างใหม่ ที่ติดตั้งและรัน `gate:fast`                                                                                                               | State, เสร็จใน T-005             |
| 7     | Hook ตรวจว่า Contract อนุมัติแล้วก่อน `red`                                                                                                                                   | State, ต้องมี ADR, เสร็จใน T-005 |
| 8     | Hook ตรวจว่า `green` แก้เฉพาะไฟล์ใน Contract                                                                                                                                  | State, ต้องมี ADR, เสร็จใน T-005 |
| 9     | ทดสอบพฤติกรรม AI ก่อนและหลังมี harness                                                                                                                                        | วัดผล                            |
| 10    | Validator อัตโนมัติให้ 32/100 เพราะหาชื่อไฟล์มาตรฐานไม่เจอ: เพิ่ม `progress.md` และ `feature_list.json` เป็นไฟล์ชี้ไปที่ไฟล์จริง ไม่ย้ายของเดิม ส่วน `init.sh` ทำจริงตามข้อ 6 | Validator, เสร็จใน T-004         |

| งาน                                    | อ้างอิง          | สถานะ                  |
| -------------------------------------- | ---------------- | ---------------------- |
| Harness: State Management              | หัวหน้างาน       | วางแล้วใน T-005        |
| Harness: Memory Management             | หัวหน้างาน       | วางแล้วใน T-004        |
| รายงานเข้าเล่มสหกิจ                    | -                | พักไว้ตามที่ผู้ใช้สั่ง |
| Metrics, alert และ error tracking      | NFR-OBS-02..04   | นอกขอบเขต Demo         |
| Load test และ security review          | NFR-PERF, SEC-15 | นอกขอบเขต Demo         |
| ยืนยัน license ของ image `cms-migrate` | ADR-0013         | รอ Tech Lead           |
