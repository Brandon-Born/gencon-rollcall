import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSession } from '../auth/auth-session';
import { FirebaseClient } from '../firebase/firebase-client';
import type { Member } from '../models/member';
import { SessionStore } from '../session/session-store';
import type { MemberStatus } from '../../shared/status/status-options';
import { normalizeDisplayName } from './member-name';

@Injectable({ providedIn: 'root' })
export class MemberProfile {
  private readonly authSession = inject(AuthSession);
  private readonly firebase = inject(FirebaseClient);
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionStore);
  private loadedUid: string | null = null;

  readonly member = signal<Member | null>(null);

  async joinCurrentMember(displayName: string): Promise<Member> {
    return this.persistMemberIdentity(displayName, 'join');
  }

  async loadCurrentMember(options: { force?: boolean } = {}): Promise<Member | null> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      this.clearLoadedMember();
      return null;
    }

    if (!options.force && this.loadedUid === uid) {
      return this.member();
    }

    const { doc, getDoc } = await import('firebase/firestore');
    const snapshot = await getDoc(doc(await this.firebase.getFirestore(), 'members', uid));

    this.loadedUid = uid;

    if (!snapshot.exists()) {
      this.member.set(null);
      this.session.setDisplayName('');
      return null;
    }

    const member = this.toMember(uid, snapshot.data());
    this.member.set(member);
    this.session.setDisplayName(member.displayName);
    return member;
  }

  async saveCurrentMember(displayName: string): Promise<Member> {
    return this.persistMemberIdentity(displayName, 'rename');
  }

  async saveCurrentStatus(status: MemberStatus, note: string): Promise<Member> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      throw new MemberProfileError('not-authorized');
    }

    const normalizedNote = normalizeNote(note);
    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    const memberRef = doc(await this.firebase.getFirestore(), 'members', uid);

    await updateDoc(memberRef, {
      status,
      note: normalizedNote,
      lastUpdatedAt: serverTimestamp(),
    });

    const savedMember = await this.loadCurrentMember({ force: true });

    if (savedMember) {
      return savedMember;
    }

    const existingMember = this.member();

    if (existingMember) {
      const fallbackMember = {
        ...existingMember,
        status,
        note: normalizedNote,
        lastUpdatedAt: new Date(),
      };
      this.member.set(fallbackMember);
      return fallbackMember;
    }

    throw new MemberProfileError('member-not-found');
  }

  async saveCurrentPin(mapId: string, mapXPercent: number, mapYPercent: number): Promise<Member> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      throw new MemberProfileError('not-authorized');
    }

    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    const normalizedX = normalizePinPercent(mapXPercent);
    const normalizedY = normalizePinPercent(mapYPercent);
    const memberRef = doc(await this.firebase.getFirestore(), 'members', uid);

    await updateDoc(memberRef, {
      mapId,
      mapXPercent: normalizedX,
      mapYPercent: normalizedY,
      locationVisible: true,
      lastUpdatedAt: serverTimestamp(),
    });

    const savedMember = await this.loadCurrentMember({ force: true });

    if (savedMember) {
      return savedMember;
    }

    const existingMember = this.member();

    if (existingMember) {
      const fallbackMember = {
        ...existingMember,
        mapId,
        mapXPercent: normalizedX,
        mapYPercent: normalizedY,
        locationVisible: true,
        lastUpdatedAt: new Date(),
      };
      this.member.set(fallbackMember);
      return fallbackMember;
    }

    throw new MemberProfileError('member-not-found');
  }

  async hideCurrentLocation(): Promise<Member> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      throw new MemberProfileError('not-authorized');
    }

    const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
    const memberRef = doc(await this.firebase.getFirestore(), 'members', uid);

    await updateDoc(memberRef, {
      mapId: null,
      mapXPercent: null,
      mapYPercent: null,
      locationVisible: false,
      lastUpdatedAt: serverTimestamp(),
    });

    const savedMember = await this.loadCurrentMember({ force: true });

    if (savedMember) {
      return savedMember;
    }

    const existingMember = this.member();

    if (existingMember) {
      const fallbackMember = {
        ...existingMember,
        mapId: null,
        mapXPercent: null,
        mapYPercent: null,
        locationVisible: false,
        lastUpdatedAt: new Date(),
      };
      this.member.set(fallbackMember);
      return fallbackMember;
    }

    throw new MemberProfileError('member-not-found');
  }

  async deleteCurrentMember(): Promise<void> {
    const user = this.authSession.user();
    const identityUrl = environment.memberIdentityUrl.trim();

    if (!user || !this.authSession.isAuthorized()) {
      throw new MemberProfileError('not-authorized');
    }

    if (!identityUrl) {
      throw new MemberProfileError('member-identity-unavailable');
    }

    try {
      await firstValueFrom(
        this.http.delete<{ ok: boolean }>(identityUrl, {
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
          },
        }),
      );
      this.clearLoadedMember();
      this.session.setDisplayName('');
    } catch (error) {
      if (error instanceof MemberProfileError) {
        throw error;
      }

      throw new MemberProfileError('member-identity-unavailable');
    }
  }

  async watchMembers(
    onMembers: (members: Member[]) => void,
    onError: (error: unknown) => void,
  ): Promise<() => void> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      onError(new MemberProfileError('not-authorized'));
      return () => undefined;
    }

    const { collection, onSnapshot } = await import('firebase/firestore');
    const membersRef = collection(await this.firebase.getFirestore(), 'members');

    return onSnapshot(
      membersRef,
      (snapshot) => {
        onMembers(snapshot.docs.map((document) => this.toMember(document.id, document.data())));
      },
      onError,
    );
  }

  clearLoadedMember(): void {
    this.loadedUid = null;
    this.member.set(null);
  }

  private async persistMemberIdentity(
    displayName: string,
    mode: 'join' | 'rename',
  ): Promise<Member> {
    const trimmedName = normalizeDisplayName(displayName);
    const user = this.authSession.user();
    const identityUrl = environment.memberIdentityUrl.trim();

    if (!trimmedName) {
      throw new MemberProfileError('display-name-required');
    }

    if (!user || !this.authSession.isAuthorized()) {
      throw new MemberProfileError('not-authorized');
    }

    if (!identityUrl) {
      throw new MemberProfileError('member-identity-unavailable');
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ ok: boolean; outcome: string; customToken?: string }>(
          identityUrl,
          { displayName: trimmedName, mode },
          {
            headers: {
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
          },
        ),
      );

      if (response.customToken) {
        await this.authSession.signInWithCustomToken(response.customToken);
      }

      this.clearLoadedMember();
      const member = await this.loadCurrentMember({ force: true });

      if (!member) {
        throw new MemberProfileError('member-not-found');
      }

      return member;
    } catch (error) {
      if (error instanceof MemberProfileError) {
        throw error;
      }

      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.error === 'display-name-taken'
      ) {
        throw new MemberProfileError('display-name-taken');
      }

      if (
        error instanceof HttpErrorResponse &&
        error.status === 404 &&
        error.error?.error === 'member-not-found'
      ) {
        throw new MemberProfileError('member-not-found');
      }

      throw new MemberProfileError('member-identity-unavailable');
    }
  }

  private toMember(id: string, data: Record<string, unknown>): Member {
    const mapId = stringOrNull(data['mapId']);
    const mapXPercent = numberOrNull(data['mapXPercent']);
    const mapYPercent = numberOrNull(data['mapYPercent']);
    const hasMapAwareLocation = mapId !== null && mapXPercent !== null && mapYPercent !== null;

    return {
      id,
      displayName: stringValue(data['displayName']),
      avatarStyle:
        stringValue(data['avatarStyle']) || avatarStyleFor(id, stringValue(data['displayName'])),
      status: memberStatusValue(data['status']),
      note: stringValue(data['note']),
      mapId: hasMapAwareLocation ? mapId : null,
      mapXPercent: hasMapAwareLocation ? mapXPercent : null,
      mapYPercent: hasMapAwareLocation ? mapYPercent : null,
      locationVisible: data['locationVisible'] === true && hasMapAwareLocation,
      joinedAt: dateValue(data['joinedAt']),
      lastUpdatedAt: dateValue(data['lastUpdatedAt']),
    };
  }
}

export type MemberProfileErrorCode =
  | 'display-name-required'
  | 'not-authorized'
  | 'member-not-found'
  | 'display-name-taken'
  | 'member-identity-unavailable';

export class MemberProfileError extends Error {
  constructor(readonly code: MemberProfileErrorCode) {
    super(code);
  }
}

function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizePinPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 1000) / 1000;
}

function avatarStyleFor(uid: string, displayName: string): string {
  const seed = `${uid}:${displayName}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `avatar-${hash % 8}`;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function memberStatusValue(value: unknown): MemberStatus {
  switch (value) {
    case 'at-event':
    case 'vendor-hall':
    case 'gaming':
    case 'food-drinks':
    case 'hotel-resting':
    case 'heading-somewhere':
    case 'available':
    case 'need-break':
    case 'offline':
      return value;
    default:
      return 'available';
  }
}

function dateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };

    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }
  }

  return new Date();
}
