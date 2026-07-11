const { createHash } = require('node:crypto') as typeof import('node:crypto');
const { cert, getApps, initializeApp } =
  require('firebase-admin/app') as typeof import('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
const { FieldValue, getFirestore } =
  require('firebase-admin/firestore') as typeof import('firebase-admin/firestore');
const { getMessaging } =
  require('firebase-admin/messaging') as typeof import('firebase-admin/messaging');

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
type NotificationKind = 'rally-created' | 'rally-response';

function header(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
function requestBody(req: RequestLike): { kind?: unknown; rallyPointId?: unknown } {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return (req.body ?? {}) as { kind?: unknown; rallyPointId?: unknown };
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
function validKind(value: unknown): value is NotificationKind {
  return value === 'rally-created' || value === 'rally-response';
}

async function handler(req: RequestLike, res: ResponseLike): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const { kind, rallyPointId } = requestBody(req);
  if (
    !validKind(kind) ||
    typeof rallyPointId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(rallyPointId)
  ) {
    res.status(400).json({ ok: false, error: 'invalid-request' });
    return;
  }
  const rally = (await db.doc(`rallyPoints/${rallyPointId}`).get()).data();
  if (!rally) {
    res.status(404).json({ ok: false, error: 'rally-not-found' });
    return;
  }

  let title: string;
  let messageBody: string;
  let excludedUid: string | null = null;
  let targetUid: string | null = null;
  let eventKey: string;
  if (kind === 'rally-created') {
    if (rally['createdByMemberId'] !== uid) {
      res.status(403).json({ ok: false, error: 'not-event-actor' });
      return;
    }
    title = `New rally: ${String(rally['title'] || 'Meet up')}`;
    messageBody = `${String(rally['createdByName'] || 'Someone')} picked a meetup spot.`;
    excludedUid = uid;
    eventKey = `${kind}:${rallyPointId}`;
  } else {
    const response = (await db.doc(`rallyPoints/${rallyPointId}/responses/${uid}`).get()).data();
    if (!response || response['memberId'] !== uid) {
      res.status(403).json({ ok: false, error: 'not-event-actor' });
      return;
    }
    const member = (await db.doc(`members/${uid}`).get()).data();
    const labels: Record<string, string> = {
      'heading-there': 'is heading there',
      arrived: 'has arrived',
      'cannot-make-it': "can't make it",
    };
    title = String(rally['title'] || 'Rally update');
    messageBody = `${String(member?.['displayName'] || 'Someone')} ${labels[String(response['responseStatus'])] || 'responded'}.`;
    targetUid = String(rally['createdByMemberId']);
    if (targetUid === uid) {
      res.status(200).json({ ok: true, sent: 0 });
      return;
    }
    eventKey = `${kind}:${rallyPointId}:${uid}:${String(response['responseStatus'])}`;
  }

  const eventId = createHash('sha256').update(eventKey).digest('hex');
  try {
    await db
      .doc(`notificationEvents/${eventId}`)
      .create({ kind, rallyPointId, actorUid: uid, createdAt: FieldValue.serverTimestamp() });
  } catch (error) {
    if ((error as { code?: number }).code === 6) {
      res.status(200).json({ ok: true, duplicate: true, sent: 0 });
      return;
    }
    throw error;
  }

  const query = targetUid
    ? db.collection('pushSubscriptions').where('uid', '==', targetUid)
    : db.collection('pushSubscriptions').where('enabled', '==', true);
  const subscriptions = (await query.get()).docs.filter(
    (document) => document.data()['enabled'] === true && document.data()['uid'] !== excludedUid,
  );
  let sent = 0;
  for (let index = 0; index < subscriptions.length; index += 500) {
    const batch = subscriptions.slice(index, index + 500);
    const result = await getMessaging().sendEachForMulticast({
      tokens: batch.map((document) => String(document.data()['token'])),
      notification: { title, body: messageBody },
      webpush: {
        notification: { icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png' },
        fcmOptions: {
          link: `https://gencon-rollcall.vercel.app/app/map?rally=${encodeURIComponent(rallyPointId)}&map=${encodeURIComponent(String(rally['mapId']))}`,
        },
      },
    });
    sent += result.successCount;
    await Promise.all(
      result.responses.flatMap((response, i) =>
        response.success ||
        ![
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token',
        ].includes(response.error?.code || '')
          ? []
          : [batch[i].ref.delete()],
      ),
    );
  }
  res.status(200).json({ ok: true, sent });
}

module.exports = handler;
