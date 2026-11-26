import type { TemplateItem, TemplateLayout } from './template';

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
  /** 고른 양식의 이름 (고를 때 저장한 값이라 그 뒤 이름을 바꿔도 그대로, SCRUM-419). 작성자의 개인 양식도 이름을 알 수 있다 */
  templateName?: string;
  materials: string[];
  /** 회의를 마무리한 시각 (끝난 회의만) */
  finishedAt?: string;
}

/** 대기 화면 양식 고르기 창에 보여 줄 양식 (REQ-123) */
export interface MinutesTemplate {
  templateId: number;
  name: string;
  /** 상세 보기 부제 */
  description?: string;
  isFavorite: boolean;
  /** 서비스 기본 양식("기본 회의록"). 워크스페이스가 양식을 따로 정하지 않았으면 이 양식이 워크스페이스 양식이다 */
  isDefault?: boolean;
  /** 카드 미리보기에 그릴 섹션 (순서, 기록 방식, 표 크기) */
  items?: TemplateItem[];
  /** 종이 설정 (여백, 정렬, 회의 기본 정보, 머리말·꼬리말, 배경). 카드·상세 미리보기에 쓴다 */
  layout?: TemplateLayout;
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
