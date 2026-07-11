export type RallyPointStatus = 'active' | 'expired';

export type RallyResponseStatus = 'heading-there' | 'arrived' | 'cannot-make-it';

export interface RallyPoint {
  id: string;
  title: string;
  note: string;
  mapId: string | null;
  mapXPercent: number;
  mapYPercent: number;
  scheduledTime: Date | null;
  createdByMemberId: string;
  createdByName: string;
  status: RallyPointStatus;
  expiresAt: Date | null;
}

export interface RallyResponse {
  id: string;
  rallyPointId: string;
  memberId: string;
  responseStatus: RallyResponseStatus;
  updatedAt: Date | null;
}
