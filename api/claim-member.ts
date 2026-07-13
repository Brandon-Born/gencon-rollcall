const { cert, getApps, initializeApp } =
  require('firebase-admin/app') as typeof import('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
const { FieldValue, getFirestore } =
  require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');

interface RequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ResponseLike;
  json(body: unknown): void;
}

interface ServiceAccount {
  projectId?: string;
  project_id?: string;
  clientEmail?: string;
  client_email?: string;
  privateKey?: string;
  private_key?: string;
}

function memberNameKey(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, 32).toLocaleLowerCase('en-US')
    : '';
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function bearerToken(req: RequestLike): string | null {
  const match = headerValue(req.headers['authorization']).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requestBody(req: RequestLike): { displayName?: unknown } {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as { displayName?: unknown };
    } catch {
      return {};
    }
  }

  return (req.body ?? {}) as { displayName?: unknown };
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

  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

function isUsingFirebaseEmulators(): boolean {
  return Boolean(
    process.env['FIRESTORE_EMULATOR_HOST'] || process.env['FIREBASE_AUTH_EMULATOR_HOST'],
  );
}

function initFirebaseAdmin(): boolean {
  if (getApps().length > 0) {
    return true;
  }

  if (isUsingFirebaseEmulators()) {
    initializeApp({
      projectId: process.env['FIREBASE_PROJECT_ID'] || 'demo-gencon-rollcall',
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
        privateKey: serviceAccount.privateKey ?? serviceAccount.private_key,
      }),
    });
  } catch {
    return false;
  }

  return true;
}

async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  if (!initFirebaseAdmin()) {
    res.status(500).json({ ok: false, error: 'server-not-configured' });
    return;
  }

  const token = bearerToken(req);
  let currentUid: string;

  try {
    currentUid = (await getAuth().verifyIdToken(token ?? '')).uid;
  } catch {
    res.status(401).json({ ok: false, error: 'auth-required' });
    return;
  }

  const db = getFirestore();
  const currentAuthorization = await db.doc(`authorizedUsers/${currentUid}`).get();

  if (!currentAuthorization.exists || currentAuthorization.data()?.['authorized'] !== true) {
    res.status(403).json({ ok: false, error: 'not-authorized' });
    return;
  }

  const normalizedName = memberNameKey(requestBody(req).displayName);

  if (!normalizedName) {
    res.status(400).json({ ok: false, error: 'display-name-required' });
    return;
  }

  const members = await db.collection('members').get();
  const matchingMembers = members.docs.filter(
    (member) => memberNameKey(member.data()['displayName']) === normalizedName,
  );

  if (!matchingMembers.length) {
    res.status(200).json({ ok: true, matched: false });
    return;
  }

  if (matchingMembers.length > 1) {
    res.status(409).json({ ok: false, error: 'ambiguous-display-name' });
    return;
  }

  const memberUid = matchingMembers[0]!.id;
  const customToken = await getAuth().createCustomToken(memberUid);
  await db.doc(`authorizedUsers/${memberUid}`).set(
    {
      authorized: true,
      lastVerifiedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  res.status(200).json({ ok: true, matched: true, customToken });
}

module.exports = handler;
