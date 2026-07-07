import { Injectable, signal } from '@angular/core';

const displayNameKey = 'gencon-rollcall.displayName';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly displayName = signal(localStorage.getItem(displayNameKey) ?? '');

  setDisplayName(displayName: string): void {
    const trimmed = displayName.trim();
    this.displayName.set(trimmed);

    if (trimmed) {
      localStorage.setItem(displayNameKey, trimmed);
    } else {
      localStorage.removeItem(displayNameKey);
    }
  }

  clear(): void {
    this.displayName.set('');
    localStorage.removeItem(displayNameKey);
  }
}
