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

// 디자인 09 "섹션 이름·AI 설명 고치기" (11/25): 항목 이름 20자, AI에게 알려 줄 설명 100자. 왼쪽 패널과 미리보기가 같이 쓴다
export const MAX_ITEM_TITLE_LENGTH = 20;
export const MAX_ITEM_DESCRIPTION_LENGTH = 100;

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

// 열 너비를 끌어 줄일 때 한 열의 최소 너비 (%, SCRUM-430)
export const MIN_COLUMN_WIDTH = 5;

/** 열 너비를 합 100으로 맞추고 소수 첫째 자리까지 반올림한다. 반올림으로 남거나 모자란 몫은 가장 넓은 열이 맡는다 */
function toHundred(widths: number[]) {
  const sum = widths.reduce((total, width) => total + width, 0);
  const rounded = widths.map((width) => Math.round((width / sum) * 1000) / 10);
  const rest = Math.round((100 - rounded.reduce((total, width) => total + width, 0)) * 10) / 10;
  const widest = rounded.indexOf(Math.max(...rounded));
  rounded[widest] = Math.round((rounded[widest] + rest) * 10) / 10;
  return rounded;
}

/** 쓸 수 있는 열 너비면 그 값, 아니면 undefined (없음, 길이가 cols와 다름, 0 이하 값) */
export function validColumnWidths(table: TableSettings, cols = table.cols) {
  const widths = table.columnWidths;
  if (!Array.isArray(widths) || widths.length !== cols || widths.some((width) => typeof width !== 'number' || !(width > 0))) {
    return undefined;
  }
  return widths;
}

/** 저장할 열 너비: 쓸 수 있으면 합 100으로 맞춘 값, 아니면 undefined (서버에 보내지 않는다) */
export function normalizeColumnWidths(table: TableSettings) {
  const widths = validColumnWidths(table);
  return widths ? toHundred(widths) : undefined;
}

/**
 * 열 수를 바꿀 때 열 너비 (사용자 결정 (B), SCRUM-430). 정해 둔 비율은 유지한다.
 * 늘리면 새 열에 원래 열들의 평균 몫(100 ÷ 원래 열 수)을 주고, 줄이면 뒤에서부터 뺀 뒤 전체를 합 100으로 다시 맞춘다.
 * 예: [10, 30, 45, 15] → 5열 [8, 24, 36, 12, 20]
 */
export function resizeColumnWidths(table: TableSettings, cols: number) {
  const widths = validColumnWidths(table);
  if (!widths || cols < 1) {
    return undefined;
  }
  const average = 100 / widths.length;
  const next = cols > widths.length ? [...widths, ...Array<number>(cols - widths.length).fill(average)] : widths.slice(0, cols);
  return toHundred(next);
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
  /** 항목을 넣을 때 채우는 AI 설명 */
  description: string;
  /** "추가할 항목 고르기" 메뉴에 보이는 짧은 설명 (디자인 09 11/27) */
  summary: string;
  recordType: ItemSettings['recordType'];
}

export const PRESET_ITEMS: PresetItem[] = [
  {
    title: '개요',
    description: '이번 회의의 목적과 주요 내용을 간단히 작성해 주세요.',
    summary: '회의 목적과 주요 내용 요약',
    recordType: 'FREE',
  },
  {
    title: '안건별 논의',
    description: '각 안건에 대한 논의 내용을 정리할 수 있어요.',
    summary: '안건마다 논의 내용을 정리',
    recordType: 'TABLE',
  },
  {
    title: '결정 사항',
    description: '회의에서 결정된 주요 사항을 정리합니다.',
    summary: '회의에서 결정된 주요 사항 정리',
    recordType: 'LIST',
  },
  {
    title: '미결 안건',
    description: '결정하지 못해 다음 회의로 넘길 안건을 정리합니다.',
    summary: '결정하지 못해 다음 회의로 넘길 안건을 정리',
    recordType: 'LIST',
  },
  {
    title: '할 일',
    description: '회의 이후 해야 할 업무와 추가 논의가 필요한 항목을 정리합니다.',
    summary: '후속 업무와 담당자, 기한을 정리',
    recordType: 'CHECKLIST',
  },
];

export const MEETING_INFO_PRESET = {
  title: '회의 기본 정보',
  description: '날짜, 시간, 장소, 참석자 등 기본 정보를 입력해요.',
  summary: '날짜, 시간, 장소, 참석자 등 기본 정보',
};

export function presetItem(preset: PresetItem): TemplateItem {
  return withColumnNames({
    title: preset.title,
    description: preset.description,
    settings: { ...DEFAULT_ITEM_SETTINGS, recordType: preset.recordType, preset: preset.title },
  });
}

// 디자인 09 11/27 "표 머리글 통일": 표는 모든 섹션 공통으로 No. / 항목 / 내용 / 비고를 실제 열 이름으로 저장하고 사용자가 고친다.
// 5번째 열부터는 비워 두고 AI가 초안을 만들 때 이름을 정한다 (SCRUM-430)
export const DEFAULT_COLUMN_NAMES = ['No.', '항목', '내용', '비고'];
// 열 이름 입력 규칙 (SCRUM-419 서버 검증과 같다): 30자 이하, |·줄바꿈 금지, 같은 표 안 같은 이름 금지
export const MAX_COLUMN_NAME_LENGTH = 30;

export function defaultColumnNames(cols: number) {
  return Array.from({ length: cols }, (_, col) => DEFAULT_COLUMN_NAMES[col] ?? '');
}

/** 표인데 열 이름이 없으면(새 표, 표로 바꿈, 열 이름 없이 저장된 예전 양식) 기본 열 이름을 채운다 */
export function withColumnNames(item: TemplateItem): TemplateItem {
  const { table } = item.settings;
  if (item.settings.recordType !== 'TABLE' || table.columnNames !== undefined) {
    return item;
  }
  return { ...item, settings: { ...item.settings, table: { ...table, columnNames: defaultColumnNames(table.cols) } } };
}

/** 입력한 열 이름에서 |와 줄바꿈을 빼고 30자로 자른다 */
export function cleanColumnName(value: string) {
  return value.replace(/[|\r\n]/g, '').slice(0, MAX_COLUMN_NAME_LENGTH);
}

/** 같은 표 안에서 이름이 겹치는 열 자리 (빈 열은 AI가 정하므로 보지 않는다) */
export function duplicateColumns(table: TableSettings) {
  const names = Array.from({ length: table.cols }, (_, col) => table.columnNames?.[col]?.trim() ?? '');
  return new Set(names.flatMap((name, col) => (name && names.indexOf(name) !== col ? [col, names.indexOf(name)] : [])));
}

/** 표시가 없는 예전 항목에 기본 항목 표시를 붙인다 (불러올 때 한 번) */
export function withPreset(item: TemplateItem): TemplateItem {
  const preset = presetOf(item);
  return preset && !item.settings.preset ? { ...item, settings: { ...item.settings, preset: preset.title } } : item;
}

/** 커스텀 항목 표시. 이름이 기본 항목과 같아도 다시 기본 항목으로 보지 않는다 (SCRUM-430) */
export const CUSTOM_PRESET = '';

/**
 * 항목의 이름이나 AI 설명을 고칠 때 쓴다. 기본 항목이었으면 커스텀으로 바꾼다 (SCRUM-430).
 * 서식(기록 방식·글자·표)만 바꾸는 곳에서는 쓰지 않는다
 */
export function editItemText(item: TemplateItem, patch: Partial<Pick<TemplateItem, 'title' | 'description'>>): TemplateItem {
  const next = { ...item, ...patch };
  const isChanged = next.title !== item.title || next.description !== item.description;
  return isChanged && presetOf(item) ? { ...next, settings: { ...next.settings, preset: CUSTOM_PRESET } } : next;
}

/** 이 항목이 어느 기본 항목인지. 표시가 없는 예전 양식은 제목이 같으면 그 기본 항목으로 본다 */
export function presetOf(item: TemplateItem) {
  const key = item.settings.preset ?? item.title;
  return PRESET_ITEMS.find((preset) => preset.title === key);
}
