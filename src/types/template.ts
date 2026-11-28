// 회의록 양식 (REQ-119~121, Figma 23-2 회의록 양식 편집). 설정 키는 minutes-service TemplateSettings와 같다

/** 기록 방식: 자유 입력형 / 목록형 / 체크리스트형 / 표 */
export type RecordType = 'FREE' | 'LIST' | 'CHECKLIST' | 'TABLE';
export type Align = 'LEFT' | 'CENTER' | 'RIGHT';
/** 표 테두리: 기본(모든 선) / 가로선만 / 바깥선만 / 없음 (SCRUM-419) */
export type TableBorder = 'BASIC' | 'HORIZONTAL' | 'OUTER' | 'NONE';

export interface TableSettings {
  /** 화면에서는 쓰지 않는다 (11/27 행 수 설정 삭제, 행은 내용에 맞춰 늘어남). 서버 저장 형식이라 값만 그대로 보낸다 */
  rows: number;
  cols: number;
  /** 화면에서는 쓰지 않는다 (11/27 열 너비 자동/수동 설정 삭제). 서버 저장 형식이라 값만 그대로 보낸다 */
  autoWidth: boolean;
  align: Align;
  border: TableBorder;
  headerColor: string;
  /**
   * 열 이름 (자리 순서대로, 비운 자리는 ""). 비운 열은 AI가 초안을 만들 때 이름을 정한다 (SCRUM-419).
   * 저장할 때 cols 길이로 맞추고, 모두 비었으면 뺀다
   */
  columnNames?: string[];
}

export interface ItemSettings {
  recordType: RecordType;
  /** px */
  titleSize: number;
  bodySize: number;
  color: string;
  /** 바깥 여백 px */
  margin: number;
  table: TableSettings;
  /**
   * 기본 항목에서 넣었으면 그 기본 항목 이름. 이름이나 AI 설명을 고치면 ""(커스텀)로 바꾸고 다시 기본 항목으로 돌리지 않는다.
   * 기록 방식·글자 같은 서식만 바꾸면 기본 항목 그대로다 (SCRUM-430, QA 78 규칙을 바꿈). 값이 없으면 예전 양식이라 이름으로 찾는다
   */
  preset?: string;
}

export interface TemplateLayout {
  /** 회의 기본 정보(일시·장소·참석자) 표시 */
  showMeetingInfo: boolean;
  /** 섹션 간격 px */
  sectionGap: number;
  marginVerticalMm: number;
  marginHorizontalMm: number;
  /** 제목 정렬 */
  align: Align;
  pageNumber: boolean;
  header: { enabled: boolean; text: string };
  footer: { enabled: boolean; text: string };
  /** REQ-157 배경 이미지 위치 (저장소 키). 없으면 배경 없음 */
  backgroundImageKey?: string;
  /** 서버가 붙여 주는 1시간짜리 주소, 막 올린 이미지는 브라우저 안 미리보기 주소. 저장할 때 서버가 버린다 */
  backgroundImageUrl?: string;
}

export interface TemplateItem {
  title: string;
  description: string;
  settings: ItemSettings;
}

export interface MinutesTemplate {
  templateId: number;
  name: string;
  description: string;
  isDefault: boolean;
  /** REQ-199 다른 사람의 양식이 내 워크스페이스 기본 양식으로 공유된 것이나 워크스페이스 양식함 사본. 쓸 수만 있고 고칠 수 없다 */
  shared?: boolean;
  /** REQ-213 워크스페이스 양식함 사본이면 그 워크스페이스 (워크스페이스 기본 양식) */
  workspaceId?: number | null;
  items: TemplateItem[];
  layout: TemplateLayout;
  /** REQ-123 내가 즐겨찾기했는지 */
  favorite: boolean;
  /** 마지막으로 고친 시각 (양식 목록 카드의 "수정 날짜") */
  updatedAt?: string;
}
