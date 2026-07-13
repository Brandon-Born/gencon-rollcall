export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyCfra0x-kz-VrqLzHY6jVG115px74DTsXg',
    authDomain: 'gencon-rollcall.firebaseapp.com',
    projectId: 'gencon-rollcall',
    messagingSenderId: '671879050351',
    appId: '1:671879050351:web:bc1f69247dbf720342c99a',
  },
  firebaseEmulators: {
    enabled: false,
    authHost: '127.0.0.1',
    authPort: 9099,
    firestoreHost: '127.0.0.1',
    firestorePort: 8080,
  },
  passwordVerificationUrl: '/api/verify-shared-password',
  memberIdentityUrl: '/api/member-identity',
  webPushPublicKey:
    'BD3q0GrXuBxBWPZTyLJrhM7bko7IyZUML1kaQhI1XV6VznmtMwWxLigwxtL502GcgdYt_V-gUlNF8n3_tGsAI1Y',
};
