import { expect, type APIRequestContext } from '@playwright/test';
import { ENV_MAILPIT_URL } from './stack-config';

const LINK = /https?:\/\/\S+token=[\w%.~-]+/;

// What the recipient would click. The worker delivers mail, so it waits for it to arrive.
export async function linkEmailedTo(request: APIRequestContext, email: string): Promise<string> {
  const mailpit = process.env[ENV_MAILPIT_URL] ?? '';
  let link = '';
  await expect
    .poll(
      async () => {
        const search = await request.get(`${mailpit}/api/v1/search`, {
          params: { query: `to:"${email}"` },
        });
        const { messages } = (await search.json()) as { messages: readonly { ID: string }[] };
        const [latest] = messages;
        if (!latest) return false;
        const message = await request.get(`${mailpit}/api/v1/message/${latest.ID}`);
        const { Text } = (await message.json()) as { Text: string };
        link = LINK.exec(Text)?.[0] ?? '';
        return link !== '';
      },
      { message: `an email with a link to ${email}`, timeout: 30_000 },
    )
    .toBe(true);
  return link;
}
