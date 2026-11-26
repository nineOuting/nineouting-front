import type { ItemSettings, TableBorder, TableSettings, TemplateItem, TemplateLayout } from '../types/template';

// 서버는 설정을 JSON 그대로 저장하므로 빠진 값은 여기 기본값으로 채운다

export const DEFAULT_TABLE: TableSettings = {
  rows: 4,
  cols: 4,
  autoWidth: true,
  align: 'LEFT',
  border: 'BASIC',
  headerColor: '#f4f4f4',
};

export const DEFAULT_ITEM_SETTINGS: ItemSettings = {
  recordType: 'FREE',
  titleSize: 16,
  bodySize: 14,
  color: '#383838',
  margin: 16,
  table: DEFAULT_TABLE,
};

export const DEFAULT_LAYOUT: TemplateLayout = {
  showMeetingInfo: true,
  sectionGap: 10,
  marginVerticalMm: 20,
  marginHorizontalMm: 20,
  align: 'LEFT',
  pageNumber: false,
  header: { enabled: false, text: '' },
  footer: { enabled: false, text: '' },
};

/**
 * 문서 종이는 실제 A4 크기 (210 × 297mm, 화면 96dpi 기준 794 × 1123px). 확대 100%면 인쇄한 A4와 같은 크기다 (SCRUM-410).
 * 양식 편집 미리보기·양식 카드·회의록 문서가 같이 쓴다
 */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

/** 1mm = 794 / 210 ≈ 3.78px */
export const PX_PER_MM = A4_WIDTH_PX / 210;

/** 실제 A4 크기로 그리므로 양식의 글자 크기(px)를 그대로 쓴다 */
export const PAPER_FONT_SCALE = 1;

/** 화면에서 처음 보이는 확대율. 70%면 종이가 약 556px로 디자인의 종이 너비(560px)와 비슷하다 */
export const DEFAULT_PAPER_ZOOM = 70;

/** 표 칸 구분: 줄 = 행, 탭 = 열 (서버 PDF와 같은 형식) */
export const CELL_SEPARATOR = '\t';

/**
 * 저장할 표 열 이름 (SCRUM-419): 앞뒤 공백을 떼고 cols 길이로 맞춘다 (모자라면 "", 넘치면 자른다). 모두 비었으면 undefined.
 * AI 서버는 길이가 cols와 다르면 거절한다. 입력 화면은 디자인이 나오면 붙인다
 */
export function normalizeColumnNames(table: TableSettings) {
  const names = Array.from({ length: table.cols }, (_, col) => table.columnNames?.[col]?.trim() ?? '');
  return names.some(Boolean) ? names : undefined;
}

type Loose<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** 예전 값 "굵게"(BOLD)는 없어졌다. 서버도 BASIC으로 바꾸지만(minutes-service V20) 바뀌기 전 응답도 기본으로 보여 준다 */
const LEGACY_BORDERS: Record<string, TableBorder> = { BOLD: 'BASIC' };

export function withItemDefaults(settings: Loose<ItemSettings> | undefined): ItemSettings {
  const table = { ...DEFAULT_TABLE, ...settings?.table };
  table.border = LEGACY_BORDERS[table.border] ?? table.border;
  return { ...DEFAULT_ITEM_SETTINGS, ...settings, table } as ItemSettings;
}

export function withLayoutDefaults(layout: Loose<TemplateLayout> | undefined): TemplateLayout {
  return {
    ...DEFAULT_LAYOUT,
    ...layout,
    header: { ...DEFAULT_LAYOUT.header, ...layout?.header },
    footer: { ...DEFAULT_LAYOUT.footer, ...layout?.footer },
  } as TemplateLayout;
}

/** 왼쪽 "회의록 항목 구성"에서 고를 수 있는 항목 (디자인 23:34~62). 기록 방식은 미리보기 디자인을 따랐다 */
export interface PresetItem {
  title: string;
  description: string;
  recordType: ItemSettings['recordType'];
}

export const PRESET_ITEMS: PresetItem[] = [
  { title: '개요', description: '이번 회의의 목적과 주요 내용을 간단히 작성해 주세요.', recordType: 'FREE' },
  { title: '안건별 논의', description: '각 안건에 대한 논의 내용을 정리할 수 있어요.', recordType: 'TABLE' },
  { title: '결정 사항', description: '회의에서 결정된 주요 사항을 정리합니다.', recordType: 'LIST' },
  { title: '미결 안건', description: '결정하지 못해 다음 회의로 넘길 안건을 정리합니다.', recordType: 'LIST' },
  { title: '할 일', description: '회의 이후 해야 할 업무와 추가 논의가 필요한 항목을 정리합니다.', recordType: 'CHECKLIST' },
];

export const MEETING_INFO_PRESET = {
  title: '회의 기본 정보',
  description: '날짜, 시간, 장소, 참석자 등 기본 정보를 입력해요.',
};

export function presetItem(preset: PresetItem): TemplateItem {
  return {
    title: preset.title,
    description: preset.description,
    settings: { ...DEFAULT_ITEM_SETTINGS, recordType: preset.recordType, preset: preset.title },
  };
}

/** 표시가 없는 예전 항목에 기본 항목 표시를 붙인다 (불러올 때 한 번) */
export function withPreset(item: TemplateItem): TemplateItem {
  const preset = presetOf(item);
  return preset && !item.settings.preset ? { ...item, settings: { ...item.settings, preset: preset.title } } : item;
}

/** 이 항목이 어느 기본 항목인지. 표시가 없는 예전 양식은 제목이 같으면 그 기본 항목으로 본다 */
export function presetOf(item: TemplateItem) {
  const key = item.settings.preset ?? item.title;
  return PRESET_ITEMS.find((preset) => preset.title === key);
}
