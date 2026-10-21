import type { Meeting, Member, MinutesTemplate, PendingAgenda, PreviousMeeting } from '../types/meeting';

// API 연동 전까지 화면을 확인하기 위한 예시 데이터 (docs/backlog.md "회의 생성·대기 화면 API 연동")

export const FOLDER_MEMBERS: Member[] = [
  { userId: 1, name: '홍길동' },
  { userId: 2, name: '김민지' },
  { userId: 3, name: '이서준' },
  { userId: 4, name: '박지우' },
  { userId: 5, name: '최유나' },
];

export const SAMPLE_MEETING: Meeting = {
  meetingId: 'sample',
  title: '프로덕트 디자인 주간 회의',
  date: '2026-10-20',
  startTime: '14:00',
  endTime: '15:00',
  location: '회의실 B',
  attendees: FOLDER_MEMBERS.slice(0, 4),
  agendas: [
    {
      id: 'agenda-1',
      title: '서비스 개선 방향 논의',
      decisionPoint: '1차 개선 과제 및 우선순위 확정',
      carriedOverFrom: '2026.10.16',
    },
    { id: 'agenda-2', title: '핵심 기능 우선순위', decisionPoint: '1차 개발에 포함할 기능 3개를 확정한다.' },
  ],
  templateId: 'template-basic',
  materials: [],
};

export const MINUTES_TEMPLATES: MinutesTemplate[] = [
  { templateId: 'template-basic', name: '기본 회의록', isFavorite: true },
  { templateId: 'template-weekly', name: '주간 회의록', isFavorite: true },
  { templateId: 'template-idea', name: '아이디어 회의록', isFavorite: false },
  { templateId: 'template-retro', name: '회고 회의록', isFavorite: false },
  { templateId: 'template-decision', name: '의사결정 회의록', isFavorite: true },
];

export const PREVIOUS_MEETINGS: PreviousMeeting[] = [
  {
    meetingId: 'previous-1',
    title: '서비스 개선 방향 논의',
    date: '2026.10.16',
    location: '회의실 B',
    attendees: FOLDER_MEMBERS,
  },
  {
    meetingId: 'previous-2',
    title: '주간 프로젝트 진행 회의',
    date: '2026.10.14',
    location: '회의실 A',
    attendees: FOLDER_MEMBERS.slice(0, 4),
  },
];

export const PENDING_AGENDAS: PendingAgenda[] = [
  {
    id: 'pending-1',
    title: '온보딩 화면 개편',
    decisionPoint: '개편 범위와 일정 확정',
    carriedOverFrom: '2026.10.14',
  },
];
