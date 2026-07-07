import { timingSafeEqual } from 'node:crypto';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest, type Request } from 'firebase-functions/v2/https';

initializeApp();

const sharedPassword = defineSecret('SHARED_SITE_PASSWORD');

const failureWindowMs = 10 * 60 * 1000;
const maxFailuresPerWindow = 8;
const failuresByIp = new Map<string, { count: number; firstFailureAt: number }>();

interface PasswordRequestBody {
  password?: unknown;
}

function bearerToken(req: Request): string | null {
  const authorization = req.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requestIp(req: Request): string {
  const forwardedFor = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || req.ip || 'unknown';
}

function isThrottled(ip: string, now: number): boolean {
  const entry = failuresByIp.get(ip);

  if (!entry) {
    return false;
  }

  if (now - entry.firstFailureAt > failureWindowMs) {
    failuresByIp.delete(ip);
    return false;
  }

  return entry.count >= maxFailuresPerWindow;
}

function recordFailure(ip: string, now: number): void {
  const entry = failuresByIp.get(ip);

  if (!entry || now - entry.firstFailureAt > failureWindowMs) {
    failuresByIp.set(ip, { count: 1, firstFailureAt: now });
    return;
  }

  entry.count += 1;
}

function clearFailures(ip: string): void {
  failuresByIp.delete(ip);
}

function passwordsMatch(submittedPassword: string, expectedPassword: string): boolean {
  const submitted = Buffer.from(submittedPassword);
  const expected = Buffer.from(expectedPassword);

  return submitted.length === expected.length && timingSafeEqual(submitted, expected);
}

export const verifySharedPassword = onRequest(
  {
    cors: true,
    region: 'us-central1',
    secrets: [sharedPassword]
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      res.status(405).json({ ok: false, error: 'method-not-allowed' });
      return;
    }

    const now = Date.now();
    const ip = requestIp(req);

    if (isThrottled(ip, now)) {
      logger.warn('Shared password verification throttled');
      res.status(429).json({ ok: false, error: 'too-many-attempts' });
      return;
    }

    const body = req.body as PasswordRequestBody | undefined;
    const submittedPassword = typeof body?.password === 'string' ? body.password : '';
    const expectedPassword = sharedPassword.value();
    const token = bearerToken(req);

    if (!expectedPassword) {
      logger.error('SHARED_SITE_PASSWORD secret is not configured');
      res.status(500).json({ ok: false, error: 'server-not-configured' });
      return;
    }

    if (!passwordsMatch(submittedPassword, expectedPassword)) {
      recordFailure(ip, now);
      res.status(401).json({ ok: false, error: 'invalid-password' });
      return;
    }

    if (!token) {
      res.status(401).json({ ok: false, error: 'auth-required' });
      return;
    }

    let uid: string;

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      uid = decodedToken.uid;
    } catch {
      res.status(401).json({ ok: false, error: 'auth-required' });
      return;
    }

    await getFirestore().doc(`authorizedUsers/${uid}`).set(
      {
        authorized: true,
        authorizedAt: FieldValue.serverTimestamp(),
        lastVerifiedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    clearFailures(ip);
    res.status(200).json({ ok: true });
  }
);
