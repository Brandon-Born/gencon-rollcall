import { MemberStatus } from '../../shared/status/status-options';

export interface Member {
  id: string;
  displayName: string;
  avatarStyle: string;
  status: MemberStatus;
  note: string;
  mapXPercent: number | null;
  mapYPercent: number | null;
  locationVisible: boolean;
  lastUpdatedAt: Date;
  joinedAt: Date;
}
