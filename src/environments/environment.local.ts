export const environment = {
  production: false,
  firebase: {
    apiKey: 'local-emulator-key',
    authDomain: 'localhost',
    projectId: 'gencon-rollcall',
    messagingSenderId: '671879050351',
    appId: '1:671879050351:web:bc1f69247dbf720342c99a'
  },
  firebaseEmulators: {
    enabled: true,
    authHost: '127.0.0.1',
    authPort: 9099,
    firestoreHost: '127.0.0.1',
    firestorePort: 8080
  },
  passwordVerificationUrl: '/api/verify-shared-password'
};
