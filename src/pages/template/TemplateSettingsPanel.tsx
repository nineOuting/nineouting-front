import { useState, type ReactNode } from 'react';
import Placeholder from '../../components/Placeholder';
import Switch from '../../components/Switch';
import type { Align, ItemSettings, RecordType, TableBorder, TemplateItem, TemplateLayout } from '../../types/template';
import styles from './TemplateSettingsPanel.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
const MAX_TITLE_LENGTH = 100;
const MAX_EDGE_LENGTH = 50;
const MAX_MARGIN_MM = 50;
const MAX_ROWS = 20;
const MAX_COLS = 8;

const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: 'FREE', label: '자유 입력형' },
  { value: 'LIST', label: '목록형' },
  { value: 'CHECKLIST', label: '체크리스트형' },
  { value: 'TABLE', label: '표' },
];
const TITLE_SIZES = [
  { value: 14, label: '작게 (14px)' },
  { value: 16, label: '중간 (16px)' },
  { value: 18, label: '크게 (18px)' },
  { value: 20, label: '아주 크게 (20px)' },
];
const BODY_SIZES = [
  { value: 12, label: '작게 (12px)' },
  { value: 14, label: '보통 (14px)' },
  { value: 16, label: '중간 (16px)' },
  { value: 18, label: '크게 (18px)' },
];
const MARGINS = [
  { value: 8, label: '좁게 (8px)' },
  { value: 16, label: '보통 (16px)' },
  { value: 24, label: '넓게 (24px)' },
];
const SECTION_GAPS = [
  { value: 10, label: '좁게(10px)' },
  { value: 16, label: '보통(16px)' },
  { value: 24, label: '넓게(24px)' },
];
const BORDERS: { value: TableBorder; label: string }[] = [
  { value: 'BASIC', label: '기본' },
  { value: 'NONE', label: '없음' },
  { value: 'BOLD', label: '굵게' },
];
const ALIGNS: { value: Align; label: string }[] = [
  { value: 'LEFT', label: '왼쪽 정렬' },
  { value: 'CENTER', label: '가운데 정렬' },
  { value: 'RIGHT', label: '오른쪽 정렬' },
];
const TEXT_COLORS = [
  { value: '#383838', label: '검정' },
  { value: '#7a7a7a', label: '회색' },
  { value: '#27187d', label: '파랑' },
  { value: '#de2021', label: '빨강' },
];
const HEADER_COLORS = [
  { value: '#e9e8f2', label: '연한 파랑' },
  { value: '#f4f4f4', label: '연한 회색' },
  { value: '#fce9e9', label: '연한 빨강' },
  { value: '#ebffeb', label: '연한 초록' },
];

type Tab = 'section' | 'layout';

interface TemplateSettingsPanelProps {
  item: TemplateItem | null;
  layout: TemplateLayout;
  onChangeItem: (item: TemplateItem) => void;
  onRemoveItem: () => void;
  canRemoveItem: boolean;
  onChangeLayout: (layout: TemplateLayout) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      {children}
    </div>
  );
}

function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <span className={styles.selectBox}>
      <select
        className={styles.select}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value);
          if (picked) {
            onChange(picked.value);
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Placeholder size={SMALL_ICON_SIZE} />
    </span>
  );
}

function Swatches({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className={styles.swatches} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          disabled={disabled}
          className={[styles.swatch, value === option.value ? styles.swatchOn : ''].filter(Boolean).join(' ')}
          style={{ background: option.value }}
          onClick={() => onChange(option.value)}
        />
      ))}
    </span>
  );
}

function AlignButtons({ label, value, onChange, disabled }: { label: string; value: Align; onChange: (value: Align) => void; disabled?: boolean }) {
  return (
    <span className={styles.segments} role="radiogroup" aria-label={label}>
      {ALIGNS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          disabled={disabled}
          className={[styles.segment, value === option.value ? styles.segmentOn : ''].filter(Boolean).join(' ')}
          onClick={() => onChange(option.value)}
        >
          <Placeholder size={SMALL_ICON_SIZE} />
        </button>
      ))}
    </span>
  );
}

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={styles.numberBox}>
      <input
        type="number"
        className={styles.number}
        aria-label={label}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) {
            onChange(Math.min(max, Math.max(min, Math.round(next))));
          }
        }}
      />
      <span className={styles.unit}>{unit}</span>
    </label>
  );
}

/** 섹션 설정 · 레이아웃 설정 (디자인 23:72, 23:278) */
export default function TemplateSettingsPanel({
  item,
  layout,
  onChangeItem,
  onRemoveItem,
  canRemoveItem,
  onChangeLayout,
}: TemplateSettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('section');
  const setSettings = (patch: Partial<ItemSettings>) => item && onChangeItem({ ...item, settings: { ...item.settings, ...patch } });
  const setTable = (patch: Partial<ItemSettings['table']>) =>
    item && setSettings({ table: { ...item.settings.table, ...patch } });
  const isTable = item?.settings.recordType === 'TABLE';

  return (
    <aside className={styles.panel} aria-label="양식 설정">
      <div className={styles.tabs} role="tablist">
        {(['section', 'layout'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={[styles.tab, tab === value ? styles.tabOn : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(value)}
          >
            {value === 'section' ? '섹션 설정' : '레이아웃 설정'}
          </button>
        ))}
      </div>

      {tab === 'section' && !item && <p className={styles.empty}>미리보기에서 설정할 섹션을 골라 주세요.</p>}

      {tab === 'section' && item && (
        <div className={styles.body} role="tabpanel">
          <div className={styles.group}>
            <div className={styles.nameBox}>
              <Placeholder size={ICON_SIZE} />
              <input
                className={styles.nameInput}
                aria-label="섹션 이름"
                maxLength={MAX_TITLE_LENGTH}
                value={item.title}
                onChange={(event) => onChangeItem({ ...item, title: event.target.value })}
              />
              <button type="button" className={styles.iconButton} aria-label="섹션 삭제" disabled={!canRemoveItem} onClick={onRemoveItem}>
                <Placeholder size={ICON_SIZE} />
              </button>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>기록 방식</span>
              <Select
                label="기록 방식"
                value={item.settings.recordType}
                options={RECORD_TYPES}
                onChange={(recordType) => setSettings({ recordType })}
              />
            </div>
          </div>
          <div className={styles.group}>
            <Row label="제목 크기">
              <Select label="제목 크기" value={item.settings.titleSize} options={TITLE_SIZES} onChange={(titleSize) => setSettings({ titleSize })} />
            </Row>
            <Row label="본문 크기">
              <Select label="본문 크기" value={item.settings.bodySize} options={BODY_SIZES} onChange={(bodySize) => setSettings({ bodySize })} />
            </Row>
            <Row label="글자 색상">
              <Swatches label="글자 색상" value={item.settings.color} options={TEXT_COLORS} onChange={(color) => setSettings({ color })} />
            </Row>
            <Row label="바깥 여백">
              <Select label="바깥 여백" value={item.settings.margin} options={MARGINS} onChange={(margin) => setSettings({ margin })} />
            </Row>
          </div>
          <hr className={styles.divider} />
          <h3 className={styles.heading}>표/셀 설정</h3>
          {!isTable && <p className={styles.hint}>기록 방식을 "표"로 고르면 바꿀 수 있어요.</p>}
          <div className={styles.tableGroup}>
            <Row label="행/열 수">
              <span className={styles.pair}>
                <NumberField label="행 수" unit="행" value={item.settings.table.rows} min={1} max={MAX_ROWS} disabled={!isTable} onChange={(rows) => setTable({ rows })} />
                <span className={styles.slash}>/</span>
                <NumberField label="열 수" unit="열" value={item.settings.table.cols} min={1} max={MAX_COLS} disabled={!isTable} onChange={(cols) => setTable({ cols })} />
              </span>
            </Row>
            <Row label="열 너비">
              <span className={styles.segments} role="radiogroup" aria-label="열 너비">
                {[true, false].map((auto) => (
                  <button
                    key={String(auto)}
                    type="button"
                    role="radio"
                    aria-checked={item.settings.table.autoWidth === auto}
                    disabled={!isTable}
                    className={[styles.segment, styles.textSegment, item.settings.table.autoWidth === auto ? styles.segmentOn : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setTable({ autoWidth: auto })}
                  >
                    {auto ? '자동' : '수동'}
                  </button>
                ))}
              </span>
            </Row>
            <Row label="셀 정렬">
              <AlignButtons label="셀 정렬" value={item.settings.table.align} disabled={!isTable} onChange={(align) => setTable({ align })} />
            </Row>
            <Row label="테두리">
              <Select label="테두리" value={item.settings.table.border} options={BORDERS} disabled={!isTable} onChange={(border) => setTable({ border })} />
            </Row>
            <Row label="헤더 행 배경색">
              <Swatches
                label="헤더 행 배경색"
                value={item.settings.table.headerColor}
                options={HEADER_COLORS}
                disabled={!isTable}
                onChange={(headerColor) => setTable({ headerColor })}
              />
            </Row>
          </div>
        </div>
      )}

      {tab === 'layout' && (
        <div className={`${styles.body} ${styles.layoutBody}`} role="tabpanel">
          <h3 className={styles.heading}>간격과 정렬</h3>
          <div className={styles.group}>
            <Row label="섹션 간격">
              <Select
                label="섹션 간격"
                value={layout.sectionGap}
                options={SECTION_GAPS}
                onChange={(sectionGap) => onChangeLayout({ ...layout, sectionGap })}
              />
            </Row>
            <div className={styles.subGroup}>
              <p className={styles.subHeading}>페이지 여백</p>
              <Row label="위쪽/아래쪽">
                <NumberField
                  label="위쪽/아래쪽 여백"
                  unit="mm"
                  value={layout.marginVerticalMm}
                  min={0}
                  max={MAX_MARGIN_MM}
                  onChange={(marginVerticalMm) => onChangeLayout({ ...layout, marginVerticalMm })}
                />
              </Row>
              <Row label="왼쪽/오른쪽">
                <NumberField
                  label="왼쪽/오른쪽 여백"
                  unit="mm"
                  value={layout.marginHorizontalMm}
                  min={0}
                  max={MAX_MARGIN_MM}
                  onChange={(marginHorizontalMm) => onChangeLayout({ ...layout, marginHorizontalMm })}
                />
              </Row>
            </div>
            <Row label="정렬 방식">
              <AlignButtons label="정렬 방식" value={layout.align} onChange={(align) => onChangeLayout({ ...layout, align })} />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>페이지 구성</h3>
            <Row label="페이지 번호 표시">
              <Switch label="페이지 번호 표시" checked={layout.pageNumber} onChange={(pageNumber) => onChangeLayout({ ...layout, pageNumber })} />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>배경 설정</h3>
            <Row label="사진 업로드">
              {/* 파일 저장소(S3) 연결이 필요해 아직 막아 둔다 (docs/backlog.md) */}
              <button type="button" className={styles.iconButton} aria-label="배경 사진 업로드" disabled title="배경 사진은 준비 중이에요">
                <Placeholder size={SMALL_ICON_SIZE} />
              </button>
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>머릿글/바닥글</h3>
            {(['header', 'footer'] as const).map((edge) => (
              <div key={edge} className={styles.edge}>
                <div className={styles.edgeHead}>
                  <span className={styles.rowLabel}>{edge === 'header' ? '머릿글 내용' : '바닥글 내용'}</span>
                  <Switch
                    label={edge === 'header' ? '머릿글 표시' : '바닥글 표시'}
                    checked={layout[edge].enabled}
                    onChange={(enabled) => onChangeLayout({ ...layout, [edge]: { ...layout[edge], enabled } })}
                  />
                </div>
                <input
                  className={styles.edgeInput}
                  aria-label={edge === 'header' ? '머릿글 내용' : '바닥글 내용'}
                  placeholder={edge === 'header' ? '회의록 양식-SYNC' : '추가 정보 입력'}
                  maxLength={MAX_EDGE_LENGTH}
                  value={layout[edge].text}
                  onChange={(event) => onChangeLayout({ ...layout, [edge]: { ...layout[edge], text: event.target.value } })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
