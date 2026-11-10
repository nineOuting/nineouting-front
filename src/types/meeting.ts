export interface Member {
  userId: number;
  name: string;
  profileImageUrl?: string;
}

export interface Agenda {
  /** 저장된 안건은 meeting-service의 agendaId, 저장 전이면 화면에서 만든 임시 값 */
  id: string;
  title: string;
  /** 결정할 사항 (1~5개, REQ-066) */
  decisionPoints: string[];
  /** 폴더의 남은 안건에서 불러온 경우 (REQ-068) */
  pendingAgendaId?: number;
  /** 남은 안건에서 불러온 경우 다음 회의로 넘긴 날짜 (REQ-051, 068) */
  carriedOverFrom?: string;
}

/** 회의 생성 화면에서 입력하는 기본 정보 (REQ-059~062) */
export interface MeetingBasicInfo {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  attendees: Member[];
}

/** meeting-service MeetingStatus */
export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export interface Meeting extends MeetingBasicInfo {
  meetingId: number;
  folderId: number;
  status: MeetingStatus;
  agendas: Agenda[];
  writer?: Member;
  /** REQ-123 대기 화면에서 고른 회의록 양식 (minutes-service). 사전 자료는 MeetingMaterials가 따로 불러온다 (REQ-067) */
  templateId?: number;
  materials: string[];
}

/** 대기 화면 양식 고르기 창에 보여 줄 양식 (REQ-123) */
export interface MinutesTemplate {
  templateId: number;
  name: string;
  isFavorite: boolean;
}

export interface PreviousMeeting {
  meetingId: number;
  title: string;
  date: string;
  location: string;
  attendees: Member[];
}

export interface PendingAgenda {
  id: number;
  title: string;
  decisionPoints: string[];
  carriedOverFrom: string;
  /** 다른 회의가 이미 불러갔으면 그 회의 */
  takenMeetingId?: number;
}
