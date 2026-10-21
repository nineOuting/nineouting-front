export interface Member {
  userId: number;
  name: string;
  profileImageUrl?: string;
}

export interface Agenda {
  id: string;
  title: string;
  decisionPoint: string;
  /** 남은 안건에서 불러온 경우 처음 올라온 회의 날짜 (REQ-051, 068) */
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

export interface Meeting extends MeetingBasicInfo {
  meetingId: string;
  agendas: Agenda[];
  writer?: Member;
  templateId?: string;
  materials: string[];
}

export interface MinutesTemplate {
  templateId: string;
  name: string;
  isFavorite: boolean;
}

export interface PreviousMeeting {
  meetingId: string;
  title: string;
  date: string;
  location: string;
  attendees: Member[];
}

export interface PendingAgenda {
  id: string;
  title: string;
  decisionPoint: string;
  carriedOverFrom: string;
}
