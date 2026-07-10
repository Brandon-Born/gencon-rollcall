export const environment = {
  production: false,
  firebase: {
    apiKey: 'local-emulator-key',
    authDomain: 'localhost',
    projectId: 'demo-gencon-rollcall',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:local',
  },
  firebaseEmulators: {
    enabled: true,
    authHost: '127.0.0.1',
    authPort: 9099,
    firestoreHost: '127.0.0.1',
    firestorePort: 8080,
  },
  passwordVerificationUrl: '/api/verify-shared-password',
};
