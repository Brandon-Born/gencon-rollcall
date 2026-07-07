import { Injectable } from '@angular/core';
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseClient {
  private app: FirebaseApp | null = null;

  readonly isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);

  getApp(): FirebaseApp {
    if (!this.isConfigured) {
      throw new Error('Firebase is not configured. Fill src/environments/environment.ts first.');
    }

    this.app ??= initializeApp(environment.firebase as FirebaseOptions);
    return this.app;
  }

  getAuth(): Auth {
    return getAuth(this.getApp());
  }

  getFirestore(): Firestore {
    return getFirestore(this.getApp());
  }

  getStorage(): FirebaseStorage {
    return getStorage(this.getApp());
  }
}
