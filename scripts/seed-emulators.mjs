const expectedProjectId = 'demo-gencon-rollcall';
const allowedFirestoreHosts = new Set(['127.0.0.1:8080', 'localhost:8080']);
const firestoreHost = process.env['FIRESTORE_EMULATOR_HOST'];
const projectId = process.env['FIREBASE_PROJECT_ID'];

if (!firestoreHost || !allowedFirestoreHosts.has(firestoreHost)) {
  throw new Error(
    'Refusing to seed: FIRESTORE_EMULATOR_HOST must be 127.0.0.1:8080 or localhost:8080.',
  );
}

if (projectId !== expectedProjectId) {
  throw new Error(`Refusing to seed: FIREBASE_PROJECT_ID must be ${expectedProjectId}.`);
}

const documentUrl = new URL(
  `/v1/projects/${projectId}/databases/(default)/documents/appConfig/current`,
  `http://${firestoreHost}`,
);
const response = await fetch(documentUrl, {
  method: 'PATCH',
  headers: {
    authorization: 'Bearer owner',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    fields: {
      mapImageUrl: { stringValue: '/maps/local-dev-map.svg' },
      mapId: { stringValue: 'local-dev' },
      mapDisplayName: { stringValue: 'Local Convention Test Map' },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  }),
});

if (!response.ok) {
  throw new Error(`Emulator seed failed with HTTP ${response.status}: ${await response.text()}`);
}

console.log(`Seeded appConfig/current in ${projectId} at ${firestoreHost}.`);
