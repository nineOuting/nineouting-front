import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { uploadTemplateBackground } from '../../api/minutes';
import alignCenterIcon from '../../assets/icons/align-center.svg';
import alignLeftIcon from '../../assets/icons/align-left.svg';
import alignRightIcon from '../../assets/icons/align-right.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import chevronUpIcon from '../../assets/icons/chevron-up-sm.svg';
import doneIcon from '../../assets/icons/done.svg';
import recordChecklistIcon from '../../assets/icons/record-checklist.svg';
import recordFreeIcon from '../../assets/icons/record-free.svg';
import recordListIcon from '../../assets/icons/record-list.svg';
import recordTableIcon from '../../assets/icons/record-table.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import Switch from '../../components/Switch';
import type { Align, ItemSettings, RecordType, TableBorder, TemplateItem, TemplateLayout } from '../../types/template';
import { withColumnNames } from '../../utils/templateSettings';
import SectionSelect from './SectionSelect';
import styles from './TemplateSettingsPanel.module.css';

const SMALL_ICON_SIZE = 16;
// 디자인 RecordTypeOption: 왼쪽 아이콘 20px, 고른 카드 오른쪽 DoneIcon 18px
const RECORD_ICON_SIZE = 20;
const DONE_ICON_SIZE = 18;
// REQ-157 배경 사진 (서버도 다시 확인한다)
const BACKGROUND_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
const MAX_EDGE_LENGTH = 50;
const MAX_MARGIN_MM = 50;
// 디자인 09 "열 수 고르기": 1~10개 (서버와 맞춤, SCRUM-419). 행 수는 정하지 않는다 (11/27, 내용에 맞춰 늘어남)
const MAX_COLS = 10;

// 디자인 09 RecordTypeOption (11/27): 기록 방식 카드 4종
const RECORD_TYPES: { value: RecordType; label: string; description: string; icon: string }[] = [
  { value: 'FREE', label: '자유 입력형', description: '문단으로 자유롭게 적어요', icon: recordFreeIcon },
  { value: 'LIST', label: '목록형', description: '한 줄씩 목록으로 적어요', icon: recordListIcon },
  { value: 'CHECKLIST', label: '체크리스트형', description: '할 일처럼 체크 칸을 붙여 한 줄씩 적어요', icon: recordChecklistIcon },
  { value: 'TABLE', label: '표', description: '열을 정해 칸에 나눠 적어요', icon: recordTableIcon },
];
// 디자인 09 글자 크기 (11/26): 이름 없이 크기만 보여 준다
const sizeOptions = (sizes: number[]) => sizes.map((value) => ({ value, label: `${value}px` }));
const TITLE_SIZES = sizeOptions([14, 16, 18, 20]);
const BODY_SIZES = sizeOptions([10, 12, 14, 16, 18]);
const MARGINS = [
  { value: 8, label: '좁게 (8px)' },
  { value: 16, label: '보통 (16px)' },
  { value: 24, label: '넓게 (24px)' },
];
// 디자인 09 "섹션 간격 고르기" (11/25)
const SECTION_GAPS = [
  { value: 10, label: '좁게 (10px)' },
  { value: 20, label: '보통 (20px)' },
  { value: 32, label: '넓게 (32px)' },
];
// 디자인 09 "테두리 고르기" (REQ-156, 11/25)
const BORDERS: { value: TableBorder; label: string }[] = [
  { value: 'BASIC', label: '기본' },
  { value: 'HORIZONTAL', label: '가로선만' },
  { value: 'OUTER', label: '바깥선만' },
  { value: 'NONE', label: '없음' },
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
  table: { title: '기록 방식', description: 'AI가 이 섹션을 어떤 모양으로 채울지 골라요.' },
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

/**
 * 디자인 09 상태 모음 "행 수·열 수·테두리·제목 크기·본문 크기·바깥 여백·섹션 간격 고르기" (REQ-156, 11/25).
 * 누르면 아래로 값 목록, 지금 값은 파란색. 고르면 문서에 바로 반영되고 닫힌다. 바깥·ESC로도 닫힌다
 */
function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** 행/열 수처럼 두 칸을 나란히 둘 때 (80px) */
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const current = options.find((option) => option.value === value);
  return (
    <span ref={rootRef} className={[styles.dropdown, compact ? styles.dropdownCompact : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={[styles.selectBox, isOpen ? styles.selectOpen : ''].filter(Boolean).join(' ')}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.select}>{current?.label ?? String(value)}</span>
        <Icon src={isOpen ? chevronUpIcon : chevronDownIcon} size={SMALL_ICON_SIZE} className={styles.selectIcon} />
      </button>
      {isOpen && (
        <ul role="listbox" aria-label={label} className={styles.menu}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={[styles.menuItem, isSelected ? styles.menuItemOn : ''].filter(Boolean).join(' ')}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}

/** 예전 목록으로 저장된 값(본문 12px, 섹션 간격 16·24px 등)은 목록 끝에 붙여 그대로 보이게 한다 */
function withSaved(options: { value: number; label: string }[], current: number) {
  return options.some(({ value }) => value === current) ? options : [...options, { value: current, label: `${current}px` }];
}

/**
 * 디자인 09 RecordTypeOption (11/27): 아이콘 + 이름 + 설명 한 줄 카드. 한 번에 하나만 고른다 (라디오).
 * 고른 카드는 보라 바탕·파란 테두리, 오른쪽에 ✓
 */
function RecordTypeOptions({ value, onChange }: { value: RecordType; onChange: (value: RecordType) => void }) {
  return (
    <div className={styles.recordOptions} role="radiogroup" aria-label="기록 방식">
      {RECORD_TYPES.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={[styles.recordOption, isSelected ? styles.recordOptionOn : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(option.value)}
          >
            <Icon src={option.icon} size={RECORD_ICON_SIZE} className={styles.recordIcon} />
            <span className={styles.recordText}>
              <span className={styles.recordLabel}>{option.label}</span>
              <span className={styles.recordDescription}>{option.description}</span>
            </span>
            {isSelected && <Icon src={doneIcon} size={DONE_ICON_SIZE} className={styles.recordDone} />}
          </button>
        );
      })}
    </div>
  );
}

/** 1~max 숫자 목록 (지금 값이 범위를 넘으면 그 값도 넣는다: 예전에 저장한 양식) */
function countOptions(max: number, unit: string, current: number) {
  const values = Array.from({ length: max }, (_, index) => index + 1);
  if (current > max) {
    values.push(current);
  }
  return values.map((count) => ({ value: count, label: `${count}${unit}` }));
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

  // 디자인 09 상태 모음 "선택한 섹션 고르기" (11/25): 아이콘 없는 드롭다운 메뉴
  const sectionPicker = (
    <div className={styles.section}>
      <h3 className={styles.heading}>선택한 항목</h3>
      <SectionSelect titles={items.map(({ title }) => title)} selectedIndex={selectedIndex} onSelect={onSelect} />
    </div>
  );

  return (
    <aside className={styles.panel} aria-label={`${texts.title} 설정`}>
      {/* 디자인 09 TemplateEditorPage_RecordType (11/27): 기록 방식 탭은 패널 제목 없이 선택한 항목부터 */}
      {view !== 'table' && (
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{texts.title}</h2>
          <p className={styles.description}>{texts.description}</p>
        </div>
      )}

      {view !== 'layout' && sectionPicker}

      {view === 'table' && item && (
        <>
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <h3 className={styles.groupTitle}>{texts.title}</h3>
              <p className={styles.groupDescription}>{texts.description}</p>
            </div>
            {/* 표로 바꾸면 기본 열 이름(No. / 항목 / 내용 / 비고)을 채운다 */}
            <RecordTypeOptions
              value={item.settings.recordType}
              onChange={(recordType) => onChangeItem(withColumnNames({ ...item, settings: { ...item.settings, recordType } }))}
            />
          </div>
          {/* 표 설정은 표를 골랐을 때만. 행 수·열 너비는 11/27에 뺐다 (행은 내용에 맞춰 늘고, 열 너비는 미리보기에서 정한다) */}
          {isTable && (
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <h3 className={styles.groupTitle}>표 설정</h3>
                <p className={styles.groupDescription}>열 수만 정해요. 행은 회의 내용에 맞춰 자동으로 늘어나요.</p>
              </div>
              <div className={styles.groupRows}>
                <Row label="열 수">
                  <Select
                    compact
                    label="열 수"
                    value={item.settings.table.cols}
                    options={countOptions(MAX_COLS, '열', item.settings.table.cols)}
                    onChange={(cols) => setTable({ cols })}
                  />
                </Row>
                <Row label="셀 정렬">
                  <AlignButtons label="셀 정렬" value={item.settings.table.align} onChange={(align) => setTable({ align })} />
                </Row>
                <Row label="테두리">
                  <Select label="테두리" value={item.settings.table.border} options={BORDERS} onChange={(border) => setTable({ border })} />
                </Row>
                <Row label="헤더 행 배경색">
                  <Swatches
                    label="헤더 행 배경색"
                    value={item.settings.table.headerColor}
                    options={HEADER_COLORS}
                    onChange={(headerColor) => setTable({ headerColor })}
                  />
                </Row>
              </div>
            </div>
          )}
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
              <Select label="본문 크기" value={item.settings.bodySize} options={withSaved(BODY_SIZES, item.settings.bodySize)} onChange={(bodySize) => setSettings({ bodySize })} />
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
                options={withSaved(SECTION_GAPS, layout.sectionGap)}
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
