import type {
  FolderDetail,
  FolderMember,
  FolderSummary,
  WorkspaceMember,
  WorkspaceSummary,
} from '../types/workspace';

// API 연동 전까지 워크스페이스·프로젝트 폴더 화면을 확인하기 위한 예시 데이터 (Figma 워크스페이스 화면 문구)

/** 지금 로그인한 사람. 예시에서는 워크스페이스와 폴더의 소유자다 */
export const ME_USER_ID = 1;

export const MY_WORKSPACES: WorkspaceSummary[] = [
  { workspaceId: 1, name: 'Sync 워크스페이스' },
  { workspaceId: 2, name: '디자인 프로젝트' },
  { workspaceId: 3, name: '스터디 그룹' },
];

export const WORKSPACE_MEMBERS: WorkspaceMember[] = [
  { userId: 1, name: '김민지', email: 'minji@gmail.com', isOwner: true, folderAccess: 'all' },
  { userId: 2, name: '이서준', email: 'seojun@gmail.com', isOwner: false, folderAccess: 'all' },
  { userId: 3, name: '박지우', email: 'jiwoo@gmail.com', isOwner: false, folderAccess: 'all' },
  { userId: 4, name: '최유나', email: 'yuna@gmail.com', isOwner: false, folderAccess: 'invited' },
  { userId: 5, name: '정하은', email: 'haeun@gmail.com', isOwner: false, folderAccess: 'all' },
  { userId: 6, name: '한도윤', email: 'doyoon@gmail.com', isOwner: false, folderAccess: 'all' },
  { userId: 7, name: '오세린', email: 'serin@gmail.com', isOwner: false, folderAccess: 'invited' },
  { userId: 8, name: '윤태호', email: 'taeho@gmail.com', isOwner: false, folderAccess: 'all' },
];

/** 이메일로 초대할 수 있는 가입한 사용자 (REQ-127 가입된 사용자만 바로 입장) */
export const REGISTERED_USERS = [
  { userId: 9, name: '강민호', email: 'minho@gmail.com' },
  { userId: 10, name: '서지안', email: 'jian@gmail.com' },
];

export const WORKSPACE_FOLDERS: FolderSummary[] = [
  { folderId: 1, name: '기본 폴더', isDefault: true, meetingCount: 2 },
  { folderId: 2, name: 'Sync 프로젝트', isDefault: false, meetingCount: 12 },
  { folderId: 3, name: '서비스 기획', isDefault: false, meetingCount: 5 },
  { folderId: 4, name: '디자인 스터디', isDefault: false, meetingCount: 3 },
];

const toFolderMember = ({ userId, name, email }: WorkspaceMember, isOwner = false): FolderMember => ({
  userId,
  name,
  email,
  isOwner,
});

const writer = { userId: 2, name: '김땡땡', affiliation: '디자인팀' };
const attendees = WORKSPACE_MEMBERS.slice(0, 7);

export const SAMPLE_FOLDER: FolderDetail = {
  folderId: 2,
  workspaceId: 1,
  workspaceName: 'Sync 워크스페이스',
  name: 'Sync 프로젝트',
  isOwner: true,
  subFolders: [
    { folderId: 21, name: '프로덕트 디자인', isDefault: false, meetingCount: 2 },
    { folderId: 22, name: '클라우드 네이티브', isDefault: false, meetingCount: 4 },
    { folderId: 23, name: '생성형 AI', isDefault: false, meetingCount: 3 },
    { folderId: 24, name: '기타', isDefault: false, meetingCount: 1 },
  ],
  meetings: [
    { meetingId: 101, title: '서비스 기획 회의', date: '2026-10-24', status: 'scheduled', writer, attendees },
    { meetingId: 102, title: '프로덕트 디자인 주간 회의', date: '2026-10-22', status: 'inProgress', writer, attendees },
    { meetingId: 103, title: '기능 검토 회의', date: '2026-10-20', status: 'reviewing', writer, attendees },
    { meetingId: 104, title: '킥오프 회의', date: '2026-10-15', status: 'confirmed', writer, attendees },
  ],
  members: [
    toFolderMember(WORKSPACE_MEMBERS[0], true),
    ...WORKSPACE_MEMBERS.slice(1, 4).map((member) => toFolderMember(member)),
  ],
  pendingAgendas: [
    { pendingAgendaId: 1, title: '출시 일정 확정', fromMeetingTitle: '서비스 기획 회의', carriedAt: '2026-10-20' },
    { pendingAgendaId: 2, title: '예산 및 리소스 검토', fromMeetingTitle: '주간 회의', carriedAt: '2026-10-15' },
    { pendingAgendaId: 3, title: '우선순위 지표 확정', fromMeetingTitle: '기능 검토 회의', carriedAt: '2026-10-12' },
  ],
};
