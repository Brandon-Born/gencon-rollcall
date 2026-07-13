import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import {
  Timestamp,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

const projectId = 'demo-gencon-rollcall-rules';
const firestoreHost = process.env['FIRESTORE_RULES_TEST_HOST'] ?? '127.0.0.1';
const firestorePort = Number(process.env['FIRESTORE_RULES_TEST_PORT'] ?? 8080);
const authPort = Number(process.env['AUTH_RULES_TEST_PORT'] ?? 9099);
const authOrigin = `http://${firestoreHost}:${authPort}`;
const firestoreOrigin = `http://${firestoreHost}:${firestorePort}`;
const apps: FirebaseApp[] = [];
let appSequence = 0;

interface TestClient {
  db: Firestore;
  uid: string | null;
}

async function createClient(
  options: { signedIn?: boolean; authorized?: boolean } = {},
): Promise<TestClient> {
  const app = initializeApp(
    {
      apiKey: 'rules-test-key',
      authDomain: 'localhost',
      projectId,
      appId: `rules-test-${appSequence}`,
    },
    `rules-test-${appSequence++}`,
  );
  apps.push(app);

  let uid: string | null = null;

  if (options.signedIn !== false) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, authOrigin, { disableWarnings: true });
    uid = (await signInAnonymously(auth)).user.uid;

    if (options.authorized) {
      await adminSet(`authorizedUsers/${uid}`, {
        authorized: { booleanValue: true },
        authorizedAt: timestampValue(new Date()),
        lastVerifiedAt: timestampValue(new Date()),
      });
    }
  }

  const db = getFirestore(app);
  connectFirestoreEmulator(db, firestoreHost, firestorePort);
  return { db, uid };
}

function documentUrl(path: string): string {
  return `${firestoreOrigin}/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

async function adminSet(path: string, fields: Record<string, unknown>): Promise<void> {
  const response = await fetch(documentUrl(path), {
    method: 'PATCH',
    headers: {
      authorization: 'Bearer owner',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Admin seed failed for ${path}: ${response.status} ${await response.text()}`);
  }
}

async function clearFirestore(): Promise<void> {
  const response = await fetch(
    `${firestoreOrigin}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );

  if (!response.ok) {
    throw new Error(`Firestore clear failed: ${response.status} ${await response.text()}`);
  }
}

function timestampValue(date: Date): { timestampValue: string } {
  return { timestampValue: date.toISOString() };
}

function nullValue(): { nullValue: null } {
  return { nullValue: null };
}

function memberFields(displayName: string): Record<string, unknown> {
  const now = new Date();
  return {
    displayName: { stringValue: displayName },
    avatarStyle: { stringValue: 'default' },
    status: { stringValue: 'available' },
    note: { stringValue: '' },
    mapId: nullValue(),
    mapXPercent: nullValue(),
    mapYPercent: nullValue(),
    locationVisible: { booleanValue: false },
    joinedAt: timestampValue(now),
    lastUpdatedAt: timestampValue(now),
  };
}

function rallyFields(
  creatorUid: string,
  options: { status?: 'active' | 'expired'; expiresAt?: Date | null } = {},
): Record<string, unknown> {
  return {
    title: { stringValue: 'Rules test rally' },
    note: { stringValue: '' },
    mapId: { stringValue: 'exhibit-hall' },
    mapXPercent: { doubleValue: 50 },
    mapYPercent: { doubleValue: 50 },
    scheduledTime: nullValue(),
    createdByMemberId: { stringValue: creatorUid },
    createdByName: { stringValue: 'Rules Tester' },
    status: { stringValue: options.status ?? 'active' },
    expiresAt:
      options.expiresAt === undefined || options.expiresAt === null
        ? nullValue()
        : timestampValue(options.expiresAt),
  };
}

function responseData(rallyPointId: string, memberId: string, responseStatus = 'heading-there') {
  return {
    rallyPointId,
    memberId,
    responseStatus,
    updatedAt: Timestamp.now(),
  };
}

async function expectDenied(operation: Promise<unknown>): Promise<void> {
  await expect(operation).rejects.toMatchObject({ code: 'permission-denied' });
}

beforeEach(async () => {
  await clearFirestore();
});

afterAll(async () => {
  await clearFirestore();
  await Promise.all(apps.map((app) => deleteApp(app)));
});

describe('shared-data authorization', () => {
  it('denies shared reads and writes before password authorization', async () => {
    const unauthenticated = await createClient({ signedIn: false });
    const signedInOnly = await createClient({ signedIn: true });
    const signedInUid = signedInOnly.uid!;

    await adminSet('appConfig/current', {
      mapImageUrl: { stringValue: '/maps/local-dev-map.svg' },
      mapDisplayName: { stringValue: 'Rules Test Map' },
    });
    await adminSet('members/existing-member', memberFields('Existing Member'));
    await adminSet('rallyPoints/existing-rally', rallyFields('existing-member'));
    await adminSet('rallyPoints/existing-rally/responses/existing-member', {
      rallyPointId: { stringValue: 'existing-rally' },
      memberId: { stringValue: 'existing-member' },
      responseStatus: { stringValue: 'arrived' },
      updatedAt: timestampValue(new Date()),
    });

    await expectDenied(getDoc(doc(unauthenticated.db, 'appConfig', 'current')));
    await expectDenied(getDoc(doc(signedInOnly.db, 'members', 'existing-member')));
    await expectDenied(getDoc(doc(signedInOnly.db, 'rallyPoints', 'existing-rally')));
    await expectDenied(
      getDoc(doc(signedInOnly.db, 'rallyPoints', 'existing-rally', 'responses', 'existing-member')),
    );
    await expectDenied(
      setDoc(doc(signedInOnly.db, 'members', signedInUid), {
        displayName: 'Unauthorized Member',
      }),
    );
    await expectDenied(
      setDoc(doc(signedInOnly.db, 'rallyPoints', 'unauthorized-rally'), {
        title: 'Unauthorized rally',
      }),
    );
  });

  it('allows authorized users to read all shared collections', async () => {
    const authorized = await createClient({ authorized: true });
    const uid = authorized.uid!;

    await adminSet('appConfig/current', {
      mapImageUrl: { stringValue: '/maps/local-dev-map.svg' },
      mapDisplayName: { stringValue: 'Rules Test Map' },
    });
    await adminSet(`members/${uid}`, memberFields('Authorized Member'));
    await adminSet('rallyPoints/readable-rally', rallyFields(uid));
    await adminSet(`rallyPoints/readable-rally/responses/${uid}`, {
      rallyPointId: { stringValue: 'readable-rally' },
      memberId: { stringValue: uid },
      responseStatus: { stringValue: 'arrived' },
      updatedAt: timestampValue(new Date()),
    });

    expect((await getDoc(doc(authorized.db, 'appConfig', 'current'))).exists()).toBe(true);
    expect((await getDoc(doc(authorized.db, 'members', uid))).exists()).toBe(true);
    expect((await getDoc(doc(authorized.db, 'rallyPoints', 'readable-rally'))).exists()).toBe(true);
    expect(
      (
        await getDoc(doc(authorized.db, 'rallyPoints', 'readable-rally', 'responses', uid))
      ).exists(),
    ).toBe(true);
  });
});

describe('member ownership and lifecycle', () => {
  it('reserves identity creation, names, and deletion for the Vercel backend', async () => {
    const owner = await createClient({ authorized: true });
    const other = await createClient({ authorized: true });
    const ownerUid = owner.uid!;
    const otherUid = other.uid!;
    const ownerRef = doc(owner.db, 'members', ownerUid);

    await expectDenied(
      setDoc(ownerRef, {
        displayName: 'Owner',
        mapId: null,
        mapXPercent: null,
        mapYPercent: null,
        locationVisible: false,
      }),
    );
    await adminSet(`members/${ownerUid}`, memberFields('Owner'));
    await expect(updateDoc(ownerRef, { note: 'Updated by owner' })).resolves.toBeUndefined();
    await expectDenied(updateDoc(ownerRef, { displayName: 'Renamed outside Vercel' }));
    await expectDenied(updateDoc(ownerRef, { nameKey: 'renamed outside vercel' }));
    await expectDenied(setDoc(doc(owner.db, 'members', otherUid), { displayName: 'Impostor' }));
    await expectDenied(updateDoc(doc(other.db, 'members', ownerUid), { note: 'Hijacked' }));
    await expectDenied(deleteDoc(doc(other.db, 'members', ownerUid)));
    await expectDenied(deleteDoc(ownerRef));
    expect((await getDoc(doc(other.db, 'members', ownerUid))).exists()).toBe(true);
    await expectDenied(getDoc(doc(owner.db, 'memberNames', 'server-owned-normalized-name-index')));
  });

  it('requires valid map-aware visible locations and consistently cleared hidden locations', async () => {
    const owner = await createClient({ authorized: true });
    const uid = owner.uid!;
    const ownerRef = doc(owner.db, 'members', uid);

    await adminSet(`members/${uid}`, memberFields('Mapped owner'));
    await expect(
      updateDoc(ownerRef, {
        mapId: 'exhibit-hall',
        mapXPercent: 42.5,
        mapYPercent: 18,
        locationVisible: true,
      }),
    ).resolves.toBeUndefined();
    await expectDenied(updateDoc(ownerRef, { mapId: 'arbitrary-map' }));
    await expectDenied(updateDoc(ownerRef, { mapXPercent: 101 }));
    await expectDenied(
      updateDoc(ownerRef, {
        mapId: null,
        mapXPercent: null,
        mapYPercent: null,
        locationVisible: true,
      }),
    );
    await expect(
      updateDoc(ownerRef, {
        mapId: null,
        mapXPercent: null,
        mapYPercent: null,
        locationVisible: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows unrelated updates to legacy members but requires map-aware location changes', async () => {
    const owner = await createClient({ authorized: true });
    const uid = owner.uid!;
    await adminSet(`members/${uid}`, {
      displayName: { stringValue: 'Legacy owner' },
      mapXPercent: { doubleValue: 50 },
      mapYPercent: { doubleValue: 50 },
      locationVisible: { booleanValue: true },
    });
    const ownerRef = doc(owner.db, 'members', uid);

    await expect(updateDoc(ownerRef, { note: 'Still allowed' })).resolves.toBeUndefined();
    await expectDenied(updateDoc(ownerRef, { mapXPercent: 55 }));
  });

  it('prevents clients from writing app config or authorization records', async () => {
    const authorized = await createClient({ authorized: true });
    const uid = authorized.uid!;

    await expectDenied(
      setDoc(doc(authorized.db, 'appConfig', 'current'), { mapDisplayName: 'Client override' }),
    );
    await expectDenied(setDoc(doc(authorized.db, 'authorizedUsers', uid), { authorized: false }));
    await expectDenied(
      setDoc(doc(authorized.db, 'pushSubscriptions', 'client-token'), {
        uid,
        token: 'clients-must-not-store-push-tokens-directly',
        enabled: true,
      }),
    );
    await expectDenied(getDoc(doc(authorized.db, 'pushSubscriptions', 'client-token')));
  });
});

describe('rally ownership and expiration', () => {
  it('allows authorized creation but only the creator can expire allowed fields', async () => {
    const creator = await createClient({ authorized: true });
    const other = await createClient({ authorized: true });
    const creatorUid = creator.uid!;
    const rallyId = 'owned-rally';
    const rallyRef = doc(creator.db, 'rallyPoints', rallyId);

    await expect(
      setDoc(rallyRef, {
        title: 'Owned rally',
        note: '',
        mapId: 'exhibit-hall',
        mapXPercent: 50,
        mapYPercent: 50,
        scheduledTime: null,
        createdByMemberId: creatorUid,
        createdByName: 'Creator',
        status: 'active',
        expiresAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z')),
      }),
    ).resolves.toBeUndefined();
    await expectDenied(
      updateDoc(doc(other.db, 'rallyPoints', rallyId), {
        status: 'expired',
        expiresAt: Timestamp.now(),
      }),
    );
    await expectDenied(updateDoc(rallyRef, { title: 'Changed title' }));
    await expect(
      updateDoc(rallyRef, { status: 'expired', expiresAt: Timestamp.now() }),
    ).resolves.toBeUndefined();
    await expectDenied(deleteDoc(rallyRef));
  });

  it('rejects rallies with missing, unknown, or out-of-range map locations', async () => {
    const creator = await createClient({ authorized: true });
    const uid = creator.uid!;
    const baseRally = {
      title: 'Mapped rally',
      note: '',
      mapXPercent: 50,
      mapYPercent: 50,
      scheduledTime: null,
      createdByMemberId: uid,
      createdByName: 'Creator',
      status: 'active',
      expiresAt: Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z')),
    };

    await expectDenied(setDoc(doc(creator.db, 'rallyPoints', 'missing-map'), baseRally));
    await expectDenied(
      setDoc(doc(creator.db, 'rallyPoints', 'unknown-map'), {
        ...baseRally,
        mapId: 'somewhere-else',
      }),
    );
    await expectDenied(
      setDoc(doc(creator.db, 'rallyPoints', 'bad-coordinate'), {
        ...baseRally,
        mapId: 'level-2',
        mapYPercent: -1,
      }),
    );
    await expect(
      setDoc(doc(creator.db, 'rallyPoints', 'valid-map'), {
        ...baseRally,
        mapId: 'level-2',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('rally response ownership and validity', () => {
  it('allows self-owned valid responses and rejects ownership or status changes', async () => {
    const creator = await createClient({ authorized: true });
    const responder = await createClient({ authorized: true });
    const attacker = await createClient({ authorized: true });
    const creatorUid = creator.uid!;
    const responderUid = responder.uid!;
    const rallyId = 'active-rally';

    await adminSet(
      `rallyPoints/${rallyId}`,
      rallyFields(creatorUid, { expiresAt: new Date('2099-01-01T00:00:00.000Z') }),
    );
    const responseRef = doc(responder.db, 'rallyPoints', rallyId, 'responses', responderUid);

    await expect(setDoc(responseRef, responseData(rallyId, responderUid))).resolves.toBeUndefined();
    await expect(
      setDoc(responseRef, responseData(rallyId, responderUid, 'arrived'), { merge: true }),
    ).resolves.toBeUndefined();
    await expectDenied(
      setDoc(
        doc(attacker.db, 'rallyPoints', rallyId, 'responses', responderUid),
        responseData(rallyId, responderUid),
      ),
    );
    await expectDenied(
      setDoc(
        doc(responder.db, 'rallyPoints', rallyId, 'responses', 'someone-else'),
        responseData(rallyId, 'someone-else'),
      ),
    );
    await expectDenied(
      setDoc(responseRef, responseData(rallyId, responderUid, 'maybe'), { merge: true }),
    );
    await expectDenied(
      setDoc(responseRef, responseData('different-rally', responderUid), { merge: true }),
    );
    await expectDenied(
      setDoc(responseRef, { ...responseData(rallyId, responderUid), extra: 'not allowed' }),
    );
    await expectDenied(deleteDoc(responseRef));
  });

  it('rejects responses when the parent rally is manually or time expired', async () => {
    const responder = await createClient({ authorized: true });
    const uid = responder.uid!;

    await adminSet(
      'rallyPoints/manually-expired',
      rallyFields(uid, { status: 'expired', expiresAt: new Date() }),
    );
    await adminSet(
      'rallyPoints/time-expired',
      rallyFields(uid, { expiresAt: new Date('2000-01-01T00:00:00.000Z') }),
    );

    await expectDenied(
      setDoc(
        doc(responder.db, 'rallyPoints', 'manually-expired', 'responses', uid),
        responseData('manually-expired', uid),
      ),
    );
    await expectDenied(
      setDoc(
        doc(responder.db, 'rallyPoints', 'time-expired', 'responses', uid),
        responseData('time-expired', uid),
      ),
    );
  });
});
