import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../../../../../test/fakes/system.fakes.js';
import { Argon2PasswordHasher } from './argon2-password-hasher.js';
import { JoseAccessTokenSigner } from './jose-access-token-signer.js';
import { Sha256OpaqueTokenService } from './sha256-opaque-token-service.js';

const SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);
const claims = { userId: 'user-1', role: 'editor' } as const;
const PASSWORD = 'correct-horse-1';

describe('Argon2PasswordHasher', () => {
  const hasher = () => new Argon2PasswordHasher({ memoryKb: 1024, iterations: 1, parallelism: 1 });

  it('uses Argon2id with the configured cost (FR-AUTH-03)', async () => {
    const hash = await hasher().hash(PASSWORD);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=1024,p=1,t=1\$/);
    expect(hash).not.toContain(PASSWORD);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const subject = hasher();
    const hash = await subject.hash(PASSWORD);

    await expect(subject.verify(hash, PASSWORD)).resolves.toBe(true);
    await expect(subject.verify(hash, 'wrong-password-1')).resolves.toBe(false);
  });

  it('salts each hash', async () => {
    const subject = hasher();

    expect(await subject.hash(PASSWORD)).not.toBe(await subject.hash(PASSWORD));
  });

  it('treats a malformed stored hash as a mismatch', async () => {
    await expect(hasher().verify('not-a-hash', PASSWORD)).resolves.toBe(false);
  });

  it('completes the no-account verification without error', async () => {
    const subject = hasher();

    await expect(subject.verifyAgainstNothing(PASSWORD)).resolves.toBeUndefined();
    await expect(subject.verifyAgainstNothing('another-password-2')).resolves.toBeUndefined();
  });
});

describe('JoseAccessTokenSigner', () => {
  const signer = (clock = new FakeClock(), secrets: [string, ...string[]] = [SECRET]) =>
    new JoseAccessTokenSigner(secrets, clock);

  it('round-trips the claims', async () => {
    const subject = signer();

    const token = await subject.sign(claims, 900);

    await expect(subject.verify(token)).resolves.toEqual(claims);
  });

  it('accepts a token until it expires, then rejects it', async () => {
    const clock = new FakeClock();
    const subject = signer(clock);
    const token = await subject.sign(claims, 900);

    clock.advanceMs(899_000);
    await expect(subject.verify(token)).resolves.toEqual(claims);

    clock.advanceMs(2_000);
    await expect(subject.verify(token)).resolves.toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signer(new FakeClock(), [OTHER_SECRET]).sign(claims, 900);

    await expect(signer().verify(token)).resolves.toBeNull();
  });

  it('accepts a previous secret during rotation and signs only with the first', async () => {
    const clock = new FakeClock();
    const oldToken = await signer(clock, [OTHER_SECRET]).sign(claims, 900);
    const rotated = signer(clock, [SECRET, OTHER_SECRET]);

    await expect(rotated.verify(oldToken)).resolves.toEqual(claims);
    const newToken = await rotated.sign(claims, 900);
    await expect(signer(clock, [SECRET]).verify(newToken)).resolves.toEqual(claims);
  });

  it.each(['garbage', '', 'a.b.c'])('rejects the malformed token "%s"', async (token) => {
    await expect(signer().verify(token)).resolves.toBeNull();
  });

  it('rejects an unsigned token', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none' })}.${encode({ sub: 'user-1', role: 'admin' })}.`;

    await expect(signer().verify(unsigned)).resolves.toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = (await signer().sign(claims, 900)).split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-1', role: 'admin' })).toString(
      'base64url',
    );

    await expect(
      signer().verify(`${String(header)}.${payload}.${String(signature)}`),
    ).resolves.toBeNull();
  });

  const signRaw = (payload: Record<string, unknown>, issuer = 'cms', audience = 'cms-admin') =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt(new FakeClock().now())
      .setExpirationTime(new Date('2030-01-01T00:00:00Z'))
      .sign(new TextEncoder().encode(SECRET));

  it('rejects a token for another audience or issuer', async () => {
    const payload = { role: 'admin', sub: 'user-1' };

    await expect(signer().verify(await signRaw(payload, 'cms', 'other'))).resolves.toBeNull();
    await expect(signer().verify(await signRaw(payload, 'other'))).resolves.toBeNull();
  });

  it('rejects a validly signed token with missing or unknown claims', async () => {
    await expect(signer().verify(await signRaw({ role: 'admin' }))).resolves.toBeNull();
    await expect(signer().verify(await signRaw({ sub: 'u', role: 'root' }))).resolves.toBeNull();
  });
});

describe('Sha256OpaqueTokenService', () => {
  const service = new Sha256OpaqueTokenService();

  it('generates a URL-safe token with 256 bits of entropy', () => {
    const token = service.generate();

    expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('generates a different token each time', () => {
    expect(service.generate()).not.toBe(service.generate());
  });

  it('hashes with SHA-256 as hex', () => {
    expect(service.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
