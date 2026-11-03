# CMS user guide

For the people who write, review and manage content. Your role decides what you can do, and the
system hides or refuses the rest.

| You want to                                   | Author        | Editor | Admin |
| --------------------------------------------- | ------------- | ------ | ----- |
| Write and edit your own drafts                | Yes           | Yes    | Yes   |
| Edit anyone's content                         | No            | Yes    | Yes   |
| Submit for review                             | Yes           | Yes    | Yes   |
| Publish, unpublish, schedule, reject          | No            | Yes    | Yes   |
| Upload media and browse the library           | Yes           | Yes    | Yes   |
| Change or delete media                        | Your own only | Yes    | Yes   |
| Manage users, API keys and read the audit log | No            | No     | Yes   |

## Signing in

You join by invitation. An Admin invites you, and the email holds a link that lasts 7 days, where you
choose a password. If it has expired, ask an Admin to use **Resend invite**.

- Forgot your password? Choose the reset link on the sign-in page, and an email follows.
- Five wrong passwords lock the account for 15 minutes. Waiting is the only way through, and an
  Admin cannot shorten it.
- After 28 idle minutes you are warned, and at 30 you are signed out. Unsaved edits to Published
  content are lost at that point, so save first.
- Change your name or password under **Settings**, where you can also choose dark mode.

## Writing content

1. Open **Content**, choose the **Articles** or **Pages** tab, then **New Article** or **New Page**.
2. Enter a **Title**. The **Slug**, the address of the item, is made from the title on the first save.
   Titles without Latin letters or digits, such as Thai ones, get a generated slug, which you should
   replace with something readable.
3. Write the body. Headings, lists, links, code blocks and images are in the toolbar.
4. Fill in the side panel: **Tags**, **Category**, **Featured Image**, and under **SEO** the
   **Meta Title** and **Meta Description**. The description defaults to the start of the body, so you
   only need to type one for an image-only article.

**Saving.** Drafts save themselves, and the top of the editor says when they last did. Published
content does not autosave, because an edit there goes live at once, so use **Save changes**.

**If someone else changed it.** You will be asked to **Reload** to see their version, or **Save a
copy** to keep yours as a new draft. Nobody's work is silently overwritten.

**Version history.** **View version history** lists every saved version and who made it. Reverting
restores the words, not the status, so reverting a published item changes what is live.

## From draft to published

| Status      | Means                                                | Who moves it on                           |
| ----------- | ---------------------------------------------------- | ----------------------------------------- |
| Draft       | Being written                                        | Author: **Submit for Review**             |
| In Review   | Waiting for an Editor, and the Author cannot edit it | Editor: **Publish** or **Reject**         |
| Scheduled   | A Draft or In Review item with a publish time        | Happens by itself, or **Cancel schedule** |
| Published   | Visible through the public API                       | Editor: **Unpublish** or **Archive**      |
| Unpublished | Taken down. Editing returns it to Draft              | Editor                                    |
| Archived    | Kept for the record, and nobody can edit it          | Nobody                                    |

**Authors.** Submit when ready. If an Editor rejects it, it returns to Draft with their note at the top
of the editor. While it is in review or published, it is with the Editors, so you can read it but not
edit it. A scheduled draft is also locked for you, so that what gets published is what was approved.

**Editors and Admins.** You may publish a Draft directly. Publishing needs a title, a slug and a
description or some body text, and the editor names whatever is missing.

- **Schedule...** picks a future time, and the item publishes within about 30 seconds of it.
- **Unpublish** takes an item off the public API within 60 seconds. **Undo** is offered for 60 seconds.
- **Delete** moves an item to the trash, with **Undo** offered for 10 seconds. Items are removed for
  good after 30 days, and only someone with database access can recover one before then.

## Media

Open **Media** to upload by dragging files in or choosing **Upload**. Images up to 20 MB and PDFs are
accepted, and SVGs up to 5 MB. A file whose contents do not match its type is refused.

- **Alt text** describes an image for people who cannot see it. Please always fill it in.
- Smaller versions of each image are made in the background within moments.
- A file that content is using cannot be deleted, and the details panel says what uses it. An Admin can
  force a deletion, which leaves that content with a missing image.
- Links from **Copy URL** expire after an hour, so do not paste them into other sites. Insert images
  through the editor, which keeps them working.

## For Admins

**Users.** **Invite user** sends the invitation. Prefer **Deactivate** to **Delete** when someone
leaves: it signs them out at once and keeps their name on their work. Deleting is refused for anyone who
has authored content, and the last active Admin cannot be removed or demoted. **Reset password** emails
them a link, and you never see or set their password.

**API Keys.** **New Key** creates a key for a frontend that reads published content. It is shown only
once, so store it right away. **Revoke** stops it immediately.

**Audit log.** **Audit Log** records who did what and when, such as sign-ins, publishing and changes to
users. Nobody can alter it, and exporting it is itself recorded.

## When something goes wrong

| What you see                      | What to do                                                 |
| --------------------------------- | ---------------------------------------------------------- |
| "Couldn't save. Retrying..."      | Keep the tab open. It retries when the connection returns. |
| "This image no longer exists"     | It was deleted from the library, so choose another.        |
| An invitation or reset never came | Check spam, then ask an Admin to send it again.            |
| An upload is refused              | Check the type and size limits above.                      |
| "Too many requests"               | Wait a minute and try again.                               |
| Anything else that keeps failing  | Tell your Admin the time and what you were doing.          |
