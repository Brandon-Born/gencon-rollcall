import { Injectable, inject } from '@angular/core';

import { AuthSession } from '../auth/auth-session';
import { FirebaseClient } from '../firebase/firebase-client';
import { MemberProfile } from '../members/member-profile';
import type { RallyPoint, RallyPointStatus } from '../models/rally-point';

export interface CreateRallyPointInput {
  title: string;
  note: string;
  mapXPercent: number;
  mapYPercent: number;
  scheduledTime: Date | null;
}

@Injectable({ providedIn: 'root' })
export class RallyPoints {
  private readonly authSession = inject(AuthSession);
  private readonly firebase = inject(FirebaseClient);
  private readonly memberProfile = inject(MemberProfile);

  async createRallyPoint(input: CreateRallyPointInput): Promise<RallyPoint> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      throw new RallyPointError('not-authorized');
    }

    const title = normalizeTitle(input.title);

    if (!title) {
      throw new RallyPointError('title-required');
    }

    const member = await this.memberProfile.loadCurrentMember();

    if (!member) {
      throw new RallyPointError('member-not-found');
    }

    const { collection, doc, setDoc } = await import('firebase/firestore');
    const firestore = await this.firebase.getFirestore();
    const rallyRef = doc(collection(firestore, 'rallyPoints'));
    const rallyPoint = {
      title,
      note: normalizeNote(input.note),
      mapXPercent: normalizeMapPercent(input.mapXPercent),
      mapYPercent: normalizeMapPercent(input.mapYPercent),
      scheduledTime: input.scheduledTime,
      createdByMemberId: uid,
      createdByName: member.displayName,
      status: 'active' as RallyPointStatus,
      expiresAt: null,
    };

    await setDoc(rallyRef, rallyPoint);

    return {
      id: rallyRef.id,
      title: rallyPoint.title,
      note: rallyPoint.note,
      mapXPercent: rallyPoint.mapXPercent,
      mapYPercent: rallyPoint.mapYPercent,
      scheduledTime: rallyPoint.scheduledTime,
      createdByMemberId: rallyPoint.createdByMemberId,
      createdByName: rallyPoint.createdByName,
      status: rallyPoint.status,
      expiresAt: rallyPoint.expiresAt,
    };
  }

  async watchRallyPoints(
    onRallyPoints: (rallyPoints: RallyPoint[]) => void,
    onError: (error: unknown) => void,
  ): Promise<() => void> {
    const uid = this.authSession.user()?.uid;

    if (!uid || !this.authSession.isAuthorized()) {
      onError(new RallyPointError('not-authorized'));
      return () => undefined;
    }

    const { collection, onSnapshot } = await import('firebase/firestore');
    const rallyPointsRef = collection(await this.firebase.getFirestore(), 'rallyPoints');

    return onSnapshot(
      rallyPointsRef,
      (snapshot) => {
        const rallyPoints = snapshot.docs
          .map((document) => this.toRallyPoint(document.id, document.data()))
          .filter((rallyPoint) => rallyPoint.status === 'active')
          .sort(compareRallyPoints);

        onRallyPoints(rallyPoints);
      },
      onError,
    );
  }

  private toRallyPoint(id: string, data: Record<string, unknown>): RallyPoint {
    return {
      id,
      title: stringValue(data['title']) || 'Untitled rally point',
      note: stringValue(data['note']),
      mapXPercent: numberValue(data['mapXPercent']),
      mapYPercent: numberValue(data['mapYPercent']),
      scheduledTime: dateOrNull(data['scheduledTime']),
      createdByMemberId: stringValue(data['createdByMemberId']),
      createdByName: stringValue(data['createdByName']) || 'Unknown member',
      status: rallyPointStatusValue(data['status']),
      expiresAt: dateOrNull(data['expiresAt']),
    };
  }
}

export type RallyPointErrorCode = 'not-authorized' | 'member-not-found' | 'title-required';

export class RallyPointError extends Error {
  constructor(readonly code: RallyPointErrorCode) {
    super(code);
  }
}

function compareRallyPoints(first: RallyPoint, second: RallyPoint): number {
  const firstScheduledTime = first.scheduledTime?.getTime() ?? Number.POSITIVE_INFINITY;
  const secondScheduledTime = second.scheduledTime?.getTime() ?? Number.POSITIVE_INFINITY;

  if (firstScheduledTime !== secondScheduledTime) {
    return firstScheduledTime - secondScheduledTime;
  }

  return first.title.localeCompare(second.title);
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').slice(0, 48);
}

function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeMapPercent(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 1000) / 1000;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? normalizeMapPercent(value) : 0;
}

function rallyPointStatusValue(value: unknown): RallyPointStatus {
  return value === 'expired' ? 'expired' : 'active';
}

function dateOrNull(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (value && typeof value === 'object' && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: () => Date };

    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }

  return null;
}
