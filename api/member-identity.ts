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

interface MemberIdentityBody {
  displayName?: unknown;
  mode?: unknown;
}

interface ServiceAccount {
  projectId?: string;
  project_id?: string;
  clientEmail?: string;
  client_email?: string;
  privateKey?: string;
  private_key?: string;
}

type IdentityMode = 'join' | 'rename';
type IdentityOutcome = 'claimed' | 'created' | 'current' | 'renamed' | 'unchanged';

class IdentityRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function normalizeDisplayName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
}

function memberNameKey(value: unknown): string {
  return normalizeDisplayName(value).toLocaleLowerCase('en-US');
}

function nameDocumentId(nameKey: string): string {
  return createHash('sha256').update(nameKey, 'utf8').digest('hex');
}

function avatarStyleFor(uid: string, displayName: string): string {
  const seed = `${uid}:${displayName}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `avatar-${hash % 8}`;
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function bearerToken(req: RequestLike): string | null {
  const match = headerValue(req.headers['authorization']).match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requestBody(req: RequestLike): MemberIdentityBody {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as MemberIdentityBody;
    } catch {
      return {};
    }
  }

  return (req.body ?? {}) as MemberIdentityBody;
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

async function authorizedUid(req: RequestLike): Promise<string> {
  let uid: string;

  try {
    uid = (await getAuth().verifyIdToken(bearerToken(req) ?? '')).uid;
  } catch {
    throw new IdentityRequestError(401, 'auth-required');
  }

  const authorization = await getFirestore().doc(`authorizedUsers/${uid}`).get();

  if (!authorization.exists || authorization.data()?.['authorized'] !== true) {
    throw new IdentityRequestError(403, 'not-authorized');
  }

  return uid;
}

async function saveIdentity(
  currentUid: string,
  displayName: string,
  mode: IdentityMode,
): Promise<{ uid: string; outcome: IdentityOutcome }> {
  const db = getFirestore();
  const nameKey = memberNameKey(displayName);
  const targetNameRef = db.doc(`memberNames/${nameDocumentId(nameKey)}`);
  const currentMemberRef = db.doc(`members/${currentUid}`);

  return db.runTransaction(async (transaction) => {
    const [targetNameSnapshot, currentMemberSnapshot] = await Promise.all([
      transaction.get(targetNameRef),
      transaction.get(currentMemberRef),
    ]);

    const targetName = targetNameSnapshot.data();

    if (targetNameSnapshot.exists && targetName?.['nameKey'] !== nameKey) {
      throw new IdentityRequestError(409, 'display-name-conflict');
    }

    if (mode === 'rename') {
      if (!currentMemberSnapshot.exists) {
        throw new IdentityRequestError(404, 'member-not-found');
      }

      if (targetNameSnapshot.exists && targetName?.['uid'] !== currentUid) {
        throw new IdentityRequestError(409, 'display-name-taken');
      }

      const currentMember = currentMemberSnapshot.data() ?? {};
      const oldNameKey = memberNameKey(currentMember['displayName']);
      const isUnchanged = oldNameKey === nameKey;

      if (!isUnchanged && oldNameKey) {
        const oldNameRef = db.doc(`memberNames/${nameDocumentId(oldNameKey)}`);
        const oldNameSnapshot = await transaction.get(oldNameRef);

        if (
          oldNameSnapshot.exists &&
          oldNameSnapshot.data()?.['uid'] === currentUid &&
          oldNameSnapshot.data()?.['nameKey'] === oldNameKey
        ) {
          transaction.delete(oldNameRef);
        }
      }

      transaction.set(
        targetNameRef,
        {
          uid: currentUid,
          nameKey,
          displayName,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.update(currentMemberRef, {
        displayName,
        nameKey,
        lastUpdatedAt: FieldValue.serverTimestamp(),
      });

      return { uid: currentUid, outcome: isUnchanged ? 'unchanged' : 'renamed' };
    }

    if (currentMemberSnapshot.exists) {
      return { uid: currentUid, outcome: 'current' };
    }

    if (targetNameSnapshot.exists && typeof targetName?.['uid'] === 'string') {
      const matchedUid = targetName['uid'] as string;
      const matchedMemberRef = db.doc(`members/${matchedUid}`);
      const matchedMemberSnapshot = await transaction.get(matchedMemberRef);

      if (matchedMemberSnapshot.exists) {
        transaction.set(
          db.doc(`authorizedUsers/${matchedUid}`),
          {
            authorized: true,
            lastVerifiedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return { uid: matchedUid, outcome: 'claimed' };
      }
    }

    transaction.set(currentMemberRef, {
      displayName,
      nameKey,
      avatarStyle: avatarStyleFor(currentUid, displayName),
      status: 'available',
      note: '',
      mapId: null,
      mapXPercent: null,
      mapYPercent: null,
      locationVisible: false,
      joinedAt: FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(targetNameRef, {
      uid: currentUid,
      nameKey,
      displayName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { uid: currentUid, outcome: 'created' };
  });
}

async function deleteIdentity(currentUid: string): Promise<void> {
  const db = getFirestore();
  const memberRef = db.doc(`members/${currentUid}`);

  await db.runTransaction(async (transaction) => {
    const memberSnapshot = await transaction.get(memberRef);

    if (memberSnapshot.exists) {
      const nameKey = memberNameKey(memberSnapshot.data()?.['displayName']);

      if (nameKey) {
        const nameRef = db.doc(`memberNames/${nameDocumentId(nameKey)}`);
        const nameSnapshot = await transaction.get(nameRef);

        if (
          nameSnapshot.exists &&
          nameSnapshot.data()?.['uid'] === currentUid &&
          nameSnapshot.data()?.['nameKey'] === nameKey
        ) {
          transaction.delete(nameRef);
        }
      }

      transaction.delete(memberRef);
    }

    transaction.delete(db.doc(`authorizedUsers/${currentUid}`));
  });
}

async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  if (!initFirebaseAdmin()) {
    res.status(500).json({ ok: false, error: 'server-not-configured' });
    return;
  }

  try {
    const currentUid = await authorizedUid(req);

    if (req.method === 'DELETE') {
      await deleteIdentity(currentUid);
      res.status(200).json({ ok: true });
      return;
    }

    const body = requestBody(req);
    const displayName = normalizeDisplayName(body.displayName);
    const mode: IdentityMode = body.mode === 'rename' ? 'rename' : 'join';

    if (!displayName) {
      throw new IdentityRequestError(400, 'display-name-required');
    }

    const result = await saveIdentity(currentUid, displayName, mode);
    const customToken =
      result.uid === currentUid ? undefined : await getAuth().createCustomToken(result.uid);

    res.status(200).json({
      ok: true,
      outcome: result.outcome,
      ...(customToken ? { customToken } : {}),
    });
  } catch (error) {
    if (error instanceof IdentityRequestError) {
      res.status(error.status).json({ ok: false, error: error.code });
      return;
    }

    res.status(500).json({ ok: false, error: 'member-identity-unavailable' });
  }
}

module.exports = handler;
