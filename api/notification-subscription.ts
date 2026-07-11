const { createHash } = require('node:crypto') as typeof import('node:crypto');
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

function header(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
function body(req: RequestLike): { token?: unknown } {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return (req.body ?? {}) as { token?: unknown };
}
function serviceAccount(): ServiceAccount | null {
  if (process.env['FIREBASE_SERVICE_ACCOUNT_JSON']) {
    try {
      return JSON.parse(process.env['FIREBASE_SERVICE_ACCOUNT_JSON']!);
    } catch {
      return null;
    }
  }
  const projectId = process.env['FIREBASE_PROJECT_ID'];
  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}
function initAdmin(): boolean {
  if (getApps().length) return true;
  if (process.env['FIRESTORE_EMULATOR_HOST']) {
    initializeApp({ projectId: process.env['FIREBASE_PROJECT_ID'] || 'demo-gencon-rollcall' });
    return true;
  }
  const value = serviceAccount();
  if (!value) return false;
  initializeApp({
    credential: cert({
      projectId: value.projectId ?? value.project_id,
      clientEmail: value.clientEmail ?? value.client_email,
      privateKey: value.privateKey ?? value.private_key,
    }),
  });
  return true;
}

async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    res.status(405).json({ ok: false });
    return;
  }
  if (!initAdmin()) {
    res.status(500).json({ ok: false, error: 'server-not-configured' });
    return;
  }
  const match = header(req.headers['authorization']).match(/^Bearer\s+(.+)$/i);
  let uid: string;
  try {
    uid = (await getAuth().verifyIdToken(match?.[1] ?? '')).uid;
  } catch {
    res.status(401).json({ ok: false, error: 'auth-required' });
    return;
  }
  const db = getFirestore();
  if (!(await db.doc(`authorizedUsers/${uid}`).get()).exists) {
    res.status(403).json({ ok: false, error: 'not-authorized' });
    return;
  }
  const token = body(req).token;
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) {
    res.status(400).json({ ok: false, error: 'invalid-token' });
    return;
  }
  const id = createHash('sha256').update(token).digest('hex');
  const ref = db.doc(`pushSubscriptions/${id}`);
  if (req.method === 'DELETE') await ref.delete();
  else
    await ref.set(
      {
        uid,
        token,
        enabled: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  res.status(200).json({ ok: true });
}

module.exports = handler;
