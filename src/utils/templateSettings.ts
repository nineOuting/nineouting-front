import type { ItemSettings, TableSettings, TemplateItem, TemplateLayout } from '../types/template';

// 서버는 설정을 JSON 그대로 저장하므로 빠진 값은 여기 기본값으로 채운다

export const DEFAULT_TABLE: TableSettings = {
  rows: 4,
  cols: 4,
  autoWidth: true,
  align: 'LEFT',
  border: 'BASIC',
  headerColor: '#e9e8f2',
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

/** A4(210mm)를 456px로 그리므로 1mm ≈ 2.17px */
export const PX_PER_MM = 456 / 210;

/** 문서 종이(456px)에 맞게 양식의 글자 크기(px)를 줄여 그린다 (16px → 약 13.6px) */
export const PAPER_FONT_SCALE = 0.85;

/** 표 칸 구분: 줄 = 행, 탭 = 열 (서버 PDF와 같은 형식) */
export const CELL_SEPARATOR = '\t';

type Loose<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export function withItemDefaults(settings: Loose<ItemSettings> | undefined): ItemSettings {
  return { ...DEFAULT_ITEM_SETTINGS, ...settings, table: { ...DEFAULT_TABLE, ...settings?.table } } as ItemSettings;
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
    settings: { ...DEFAULT_ITEM_SETTINGS, recordType: preset.recordType },
  };
}
