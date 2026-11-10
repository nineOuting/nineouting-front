// 회의록 양식 (REQ-119~121, Figma 23-2 회의록 양식 편집). 설정 키는 minutes-service TemplateSettings와 같다

/** 기록 방식: 자유 입력형 / 목록형 / 체크리스트형 / 표 */
export type RecordType = 'FREE' | 'LIST' | 'CHECKLIST' | 'TABLE';
export type Align = 'LEFT' | 'CENTER' | 'RIGHT';
export type TableBorder = 'BASIC' | 'NONE' | 'BOLD';

export interface TableSettings {
  rows: number;
  cols: number;
  /** 열 너비 자동(true) / 수동 */
  autoWidth: boolean;
  align: Align;
  border: TableBorder;
  headerColor: string;
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
  items: TemplateItem[];
  layout: TemplateLayout;
  /** REQ-123 내가 즐겨찾기했는지 */
  favorite: boolean;
}
