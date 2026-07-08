const { timingSafeEqual } = require('node:crypto') as typeof import('node:crypto');
const { cert, getApps, initializeApp } = require('firebase-admin/app') as typeof import('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');

interface RequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: {
    remoteAddress?: string;
  };
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

interface PasswordRequestBody {
  password?: unknown;
}

interface ServiceAccount {
  projectId?: string;
  project_id?: string;
  clientEmail?: string;
  client_email?: string;
  privateKey?: string;
  private_key?: string;
}

const failureWindowMs = 10 * 60 * 1000;
const maxFailuresPerWindow = 8;
const failuresByIp = new Map<string, { count: number; firstFailureAt: number }>();

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function requestIp(req: RequestLike): string {
  const forwardedFor = headerValue(req.headers['x-forwarded-for']).split(',')[0]?.trim();
  return forwardedFor || req.socket?.remoteAddress || 'unknown';
}

function bearerToken(req: RequestLike): string | null {
  const authorization = headerValue(req.headers['authorization']);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requestBody(req: RequestLike): PasswordRequestBody {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as PasswordRequestBody;
    } catch {
      return {};
    }
  }

  return (req.body ?? {}) as PasswordRequestBody;
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

function serviceAccountFromEnv(): ServiceAccount | null {
  const rawJson = process.env['FIREBASE_SERVICE_ACCOUNT_JSON'];

  if (rawJson) {
    try {
      return JSON.parse(rawJson) as ServiceAccount;
    } catch {
      return null;
    }
  }

  const projectId = process.env['FIREBASE_PROJECT_ID'];
  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

function isUsingFirebaseEmulators(): boolean {
  return Boolean(process.env['FIRESTORE_EMULATOR_HOST'] || process.env['FIREBASE_AUTH_EMULATOR_HOST']);
}

function initFirebaseAdmin(): boolean {
  if (getApps().length > 0) {
    return true;
  }

  if (isUsingFirebaseEmulators()) {
    initializeApp({
      projectId: process.env['FIREBASE_PROJECT_ID'] || 'gencon-rollcall'
    });
    return true;
  }

  const serviceAccount = serviceAccountFromEnv();

  if (!serviceAccount) {
    return false;
  }

  try {
    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId ?? serviceAccount.project_id,
        clientEmail: serviceAccount.clientEmail ?? serviceAccount.client_email,
        privateKey: serviceAccount.privateKey ?? serviceAccount.private_key
      })
    });
  } catch {
    return false;
  }

  return true;
}

async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  const expectedPassword = isUsingFirebaseEmulators()
    ? process.env['LOCAL_SHARED_SITE_PASSWORD'] ?? process.env['SHARED_SITE_PASSWORD']
    : process.env['SHARED_SITE_PASSWORD'];

  if (!expectedPassword || !initFirebaseAdmin()) {
    res.status(500).json({ ok: false, error: 'server-not-configured' });
    return;
  }

  const now = Date.now();
  const ip = requestIp(req);

  if (isThrottled(ip, now)) {
    res.status(429).json({ ok: false, error: 'too-many-attempts' });
    return;
  }

  const body = requestBody(req);
  const submittedPassword = typeof body.password === 'string' ? body.password : '';

  if (!passwordsMatch(submittedPassword, expectedPassword)) {
    recordFailure(ip, now);
    res.status(401).json({ ok: false, error: 'invalid-password' });
    return;
  }

  const token = bearerToken(req);

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

module.exports = handler;
