import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { uploadTemplateBackground } from '../../api/minutes';
import alignCenterIcon from '../../assets/icons/align-center.svg';
import alignLeftIcon from '../../assets/icons/align-left.svg';
import alignRightIcon from '../../assets/icons/align-right.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import ballotIcon from '../../assets/icons/rail-ballot.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import Switch from '../../components/Switch';
import type { Align, ItemSettings, RecordType, TableBorder, TemplateItem, TemplateLayout } from '../../types/template';
import styles from './TemplateSettingsPanel.module.css';

const SMALL_ICON_SIZE = 16;
// REQ-157 배경 사진 (서버도 다시 확인한다)
const BACKGROUND_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
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
const ALIGNS: { value: Align; label: string; icon: string }[] = [
  { value: 'LEFT', label: '왼쪽 정렬', icon: alignLeftIcon },
  { value: 'CENTER', label: '가운데 정렬', icon: alignCenterIcon },
  { value: 'RIGHT', label: '오른쪽 정렬', icon: alignRightIcon },
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

export type SettingsView = 'table' | 'text' | 'layout';

const VIEW_TEXTS: Record<SettingsView, { title: string; description: string }> = {
  table: { title: '표', description: '표 형식 섹션의 행과 열, 셀 모양을 설정해요.' },
  text: { title: '글자', description: '선택한 섹션의 글자 크기와 색상, 여백을 설정해요.' },
  layout: { title: '레이아웃', description: '문서 전체의 간격과 여백, 페이지 구성을 설정해요.' },
};

interface TemplateSettingsPanelProps {
  view: SettingsView;
  items: TemplateItem[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  layout: TemplateLayout;
  onChangeItem: (item: TemplateItem) => void;
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
      <Icon src={chevronDownIcon} size={SMALL_ICON_SIZE} className={styles.selectIcon} />
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
          <Icon src={option.icon} size={SMALL_ICON_SIZE} />
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

/** 디자인 TemplateEditorPage_Table, _Text, _Layout 왼쪽 패널. 섹션 이름 고치기, 삭제는 미리보기 카드에서 한다 */
export default function TemplateSettingsPanel({
  view,
  items,
  selectedIndex,
  onSelect,
  layout,
  onChangeItem,
  onChangeLayout,
}: TemplateSettingsPanelProps) {
  const item = selectedIndex !== null ? (items[selectedIndex] ?? null) : null;
  const setSettings = (patch: Partial<ItemSettings>) => item && onChangeItem({ ...item, settings: { ...item.settings, ...patch } });
  const setTable = (patch: Partial<ItemSettings['table']>) =>
    item && setSettings({ table: { ...item.settings.table, ...patch } });
  const isTable = item?.settings.recordType === 'TABLE';
  // REQ-157 배경 사진: 저장소에 바로 올리고, 양식을 저장할 때 위치(키)를 함께 저장한다
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState<string>();
  const uploadBackground = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!BACKGROUND_TYPES.includes(file.type) || file.size > MAX_BACKGROUND_BYTES) {
      setBackgroundError('배경 사진은 5MB 이하의 PNG, JPEG, WebP만 올릴 수 있어요.');
      return;
    }
    setBackgroundError(undefined);
    setIsUploadingBackground(true);
    try {
      const imageKey = await uploadTemplateBackground(file);
      onChangeLayout({ ...layout, backgroundImageKey: imageKey, backgroundImageUrl: URL.createObjectURL(file) });
    } catch (error) {
      setBackgroundError(errorMessage(error));
    } finally {
      setIsUploadingBackground(false);
    }
  };
  const texts = VIEW_TEXTS[view];

  const sectionPicker = (
    <div className={styles.section}>
      <h3 className={styles.heading}>선택한 섹션</h3>
      <span className={`${styles.selectBox} ${styles.pickerBox}`}>
        <Icon src={ballotIcon} size={SMALL_ICON_SIZE} className={styles.selectIcon} />
        <select
          className={styles.select}
          aria-label="선택한 섹션"
          value={selectedIndex ?? ''}
          onChange={(event) => onSelect(Number(event.target.value))}
        >
          {selectedIndex === null && <option value="">섹션을 골라 주세요</option>}
          {items.map((option, index) => (
            <option key={`${option.title}-${index}`} value={index}>
              {option.title || '제목 없음'}
            </option>
          ))}
        </select>
        <Icon src={chevronDownIcon} size={SMALL_ICON_SIZE} className={styles.selectIcon} />
      </span>
    </div>
  );

  return (
    <aside className={styles.panel} aria-label={`${texts.title} 설정`}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{texts.title}</h2>
        <p className={styles.description}>{texts.description}</p>
      </div>

      {view !== 'layout' && sectionPicker}

      {view === 'table' && item && (
        <>
          <div className={styles.section}>
            <h3 className={styles.heading}>섹션 형식</h3>
            <Row label="기록 방식">
              <Select
                label="기록 방식"
                value={item.settings.recordType}
                options={RECORD_TYPES}
                onChange={(recordType) => setSettings({ recordType })}
              />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>표/셀 설정</h3>
            {!isTable && <p className={styles.hint}>기록 방식을 "표"로 고르면 바꿀 수 있어요.</p>}
            <Row label="행/열 수">
              <span className={styles.pair}>
                <NumberField label="행 수" unit="행" value={item.settings.table.rows} min={1} max={MAX_ROWS} disabled={!isTable} onChange={(rows) => setTable({ rows })} />
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
        </>
      )}

      {view === 'text' && item && (
        <>
          <div className={styles.section}>
            <h3 className={styles.heading}>글자 서식</h3>
            <Row label="제목 크기">
              <Select label="제목 크기" value={item.settings.titleSize} options={TITLE_SIZES} onChange={(titleSize) => setSettings({ titleSize })} />
            </Row>
            <Row label="본문 크기">
              <Select label="본문 크기" value={item.settings.bodySize} options={BODY_SIZES} onChange={(bodySize) => setSettings({ bodySize })} />
            </Row>
            <Row label="글자 색상">
              <Swatches label="글자 색상" value={item.settings.color} options={TEXT_COLORS} onChange={(color) => setSettings({ color })} />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>여백</h3>
            <Row label="바깥 여백">
              <Select label="바깥 여백" value={item.settings.margin} options={MARGINS} onChange={(margin) => setSettings({ margin })} />
            </Row>
          </div>
        </>
      )}

      {view === 'layout' && (
        <>
          <div className={styles.section}>
            <h3 className={styles.heading}>간격과 정렬</h3>
            <Row label="섹션 간격">
              <Select
                label="섹션 간격"
                value={layout.sectionGap}
                options={SECTION_GAPS}
                onChange={(sectionGap) => onChangeLayout({ ...layout, sectionGap })}
              />
            </Row>
            <Row label="정렬 방식">
              <AlignButtons label="정렬 방식" value={layout.align} onChange={(align) => onChangeLayout({ ...layout, align })} />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>페이지 여백</h3>
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
          <div className={styles.section}>
            <h3 className={styles.heading}>페이지 구성</h3>
            <Row label="페이지 번호 표시">
              <Switch label="페이지 번호 표시" checked={layout.pageNumber} onChange={(pageNumber) => onChangeLayout({ ...layout, pageNumber })} />
            </Row>
          </div>
          <div className={styles.section}>
            <h3 className={styles.heading}>배경 설정</h3>
            <Row label="사진 업로드">
              <button
                type="button"
                className={styles.iconButton}
                aria-label="배경 사진 업로드"
                disabled={isUploadingBackground}
                onClick={() => backgroundInputRef.current?.click()}
              >
                {isUploadingBackground ? <Spinner size={SMALL_ICON_SIZE} /> : <Icon src={uploadIcon} size={SMALL_ICON_SIZE} />}
              </button>
              <input
                ref={backgroundInputRef}
                type="file"
                accept={BACKGROUND_TYPES.join(',')}
                hidden
                onChange={(event) => void uploadBackground(event)}
              />
            </Row>
            {layout.backgroundImageUrl && (
              <div className={styles.backgroundPreview}>
                <img src={layout.backgroundImageUrl} alt="배경 사진 미리보기" className={styles.backgroundImage} />
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => onChangeLayout({ ...layout, backgroundImageKey: undefined, backgroundImageUrl: undefined })}
                >
                  배경 사진 빼기
                </button>
              </div>
            )}
            {backgroundError && <p className={styles.error}>{backgroundError}</p>}
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
        </>
      )}
    </aside>
  );
}
