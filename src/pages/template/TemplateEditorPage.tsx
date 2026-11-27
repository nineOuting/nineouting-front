import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { createMinutesTemplate, listMinutesTemplates, updateMinutesTemplate } from '../../api/minutes';
import ConfirmDialog from '../../components/ConfirmDialog';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import ballotIcon from '../../assets/icons/rail-ballot.svg';
import layoutIcon from '../../assets/icons/rail-layout.svg';
import recordIcon from '../../assets/icons/rail-record.svg';
import textIcon from '../../assets/icons/rail-text.svg';
import refreshIcon from '../../assets/icons/refresh.svg';
import templateIcon from '../../assets/icons/template-sm.svg';
import EditorTopBar from '../../components/EditorTopBar';
import editorBar from '../../components/EditorTopBar.module.css';
import Icon from '../../components/Icon';
import Sidebar from '../../components/Sidebar';
import SidebarRail from '../../components/SidebarRail';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { MinutesTemplate, TemplateItem, TemplateLayout } from '../../types/template';
import {
  DEFAULT_ITEM_SETTINGS,
  DEFAULT_LAYOUT,
  MEETING_INFO_PRESET,
  normalizeColumnNames,
  PRESET_ITEMS,
  presetItem,
  presetOf,
  withPreset,
} from '../../utils/templateSettings';
import AddItemSelect from './AddItemSelect';
import SectionSelect from './SectionSelect';
import TemplatePreview from './TemplatePreview';
import TemplateSettingsPanel, { type SettingsView } from './TemplateSettingsPanel';
import styles from './TemplateEditorPage.module.css';

const RAIL_ICON_SIZE = 24;
const BUTTON_ICON_SIZE = 16;
const COLLAPSE_ICON_SIZE = 16;
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 100;
// 디자인 09 "[커스텀 항목 추가] 누른 직후" (11/25): 이름은 "새 항목", AI 설명은 비워 둔다
const CUSTOM_TITLE = '새 항목';
const CUSTOM_DESCRIPTION = '';
// 디자인 09 "섹션 이름·AI 설명 고치기" (11/25): 항목 이름 20자, AI에게 알려 줄 설명 100자
const MAX_ITEM_TITLE_LENGTH = 20;
const MAX_ITEM_DESCRIPTION_LENGTH = 100;

interface Draft {
  name: string;
  description: string;
  items: TemplateItem[];
  layout: TemplateLayout;
}

type RailView = 'items' | SettingsView;

// 디자인 SideRail: 항목 구성, 기록 방식(11/27 [표]에서 이름 바꿈), 글자, 레이아웃
const RAIL: { value: RailView; label: string; icon: string }[] = [
  { value: 'items', label: '항목 구성', icon: ballotIcon },
  { value: 'table', label: '기록 방식', icon: recordIcon },
  { value: 'text', label: '글자', icon: textIcon },
  { value: 'layout', label: '레이아웃', icon: layoutIcon },
];

const EMPTY_DRAFT: Draft = { name: '', description: '', items: [], layout: DEFAULT_LAYOUT };

/** 기본 양식의 항목·레이아웃 (기본 양식으로 초기화) */
function fromDefault(templates: MinutesTemplate[], name: string, description: string): Draft {
  const base = templates.find((template) => template.isDefault);
  return { name, description, items: (base?.items ?? []).map(withPreset), layout: base?.layout ?? DEFAULT_LAYOUT };
}

/** 같은 제목이 이미 있으면 뒤에 숫자를 붙인다 */
function uniqueTitle(items: TemplateItem[], title: string) {
  const titles = new Set(items.map((item) => item.title));
  if (!titles.has(title)) {
    return title;
  }
  let suffix = 2;
  while (titles.has(`${title} ${suffix}`)) {
    suffix += 1;
  }
  return `${title} ${suffix}`;
}

/** 디자인 09 입력칸 Helper: 오른쪽 끝에 지금 글자 수(회색)와 / 최대(연한 회색) */
function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={styles.counter}>
      <span className={styles.counterLength}>{length}</span> / {max}
    </span>
  );
}

/** REQ-120~121 회의록 양식 만들기·편집 (Figma 23-2 회의록 양식 커스텀). ?from=양식ID 이면 그 양식을 복사해 시작한다 */
export default function TemplateEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const editingId = templateId ? Number(templateId) : null;
  const copyFrom = searchParams.get('from');
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<RailView>('items');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  // QA 71 왼쪽 패널을 접어 문서를 넓게 본다 (피그마 PanelCollapseHandle)
  const [isSideOpen, setIsSideOpen] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isCurrent = true;
    listMinutesTemplates()
      .then((list) => {
        if (!isCurrent) {
          return;
        }
        setTemplates(list);
        const source = list.find(({ templateId: id }) => id === (editingId ?? Number(copyFrom)));
        // QA 64 기본 양식은 내 기본 양식으로 고친다. 공유받은 양식만 고칠 수 없다
        if (editingId !== null && (!source || source.shared)) {
          setToast({ text: '고칠 수 없는 양식이에요.', variant: 'error' });
        }
        setDraft(
          source
            ? {
                name: editingId !== null ? source.name : `${source.name} (사본)`.slice(0, MAX_NAME_LENGTH),
                description: source.description,
                items: source.items.map(withPreset),
                layout: source.layout,
              }
            : fromDefault(list, '', ''),
        );
        setIsLoaded(true);
      })
      .catch((error: unknown) => isCurrent && setToast({ text: errorMessage(error), variant: 'error' }));
    return () => {
      isCurrent = false;
    };
  }, [editingId, copyFrom]);

  const setItems = (items: TemplateItem[]) => setDraft((prev) => ({ ...prev, items }));
  const selectedItem = selectedIndex === null ? undefined : draft.items[selectedIndex];
  /** 선택한 섹션의 이름·AI 설명 고치기 (항목 구성 패널) */
  const updateSelected = (patch: Partial<TemplateItem>) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, index) => (index === selectedIndex ? { ...item, ...patch } : item)),
    }));
  // QA 78 기본 항목은 제목을 고쳐도 같은 자리로 본다
  const presetIndexOf = (preset: (typeof PRESET_ITEMS)[number]) => draft.items.findIndex((item) => presetOf(item) === preset);

  /** "추가할 항목 고르기"에서 고른 기본 항목을 문서 끝에 넣고 고른다. 회의 기본 정보는 항목이 아니라 문서 머리에 켠다 */
  const addPreset = (key: string) => {
    if (key === MEETING_INFO_PRESET.title) {
      setDraft((prev) => ({ ...prev, layout: { ...prev.layout, showMeetingInfo: true } }));
      return;
    }
    const preset = PRESET_ITEMS.find(({ title }) => title === key);
    if (!preset || presetIndexOf(preset) >= 0) {
      return;
    }
    setItems([...draft.items, presetItem(preset)]);
    setSelectedIndex(draft.items.length);
  };
  const addCustom = () => {
    const title = uniqueTitle(draft.items, CUSTOM_TITLE);
    setItems([
      ...draft.items,
      { title, description: CUSTOM_DESCRIPTION, settings: { ...DEFAULT_ITEM_SETTINGS, recordType: 'LIST' } },
    ]);
    setSelectedIndex(draft.items.length);
  };
  const removeItem = (index: number) => {
    if (draft.items.length <= 1) {
      setToast({ text: '항목을 1개 이상 남겨 주세요.', variant: 'error' });
      return;
    }
    setItems(draft.items.filter((_, position) => position !== index));
    setSelectedIndex((selected) => (selected === null || selected < index ? selected : Math.max(0, selected - 1)));
  };
  const moveItem = (from: number, to: number) => {
    const next = [...draft.items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setSelectedIndex(to);
  };

  const save = async () => {
    // 표 열 이름은 cols 길이로 맞춰 보낸다 (AI 서버가 길이가 다르면 거절한다). 모두 비었으면 뺀다 (SCRUM-419)
    const items = draft.items.map((item) => {
      const { columnNames: _, ...table } = item.settings.table;
      const columnNames = item.settings.recordType === 'TABLE' ? normalizeColumnNames(item.settings.table) : undefined;
      return {
        ...item,
        title: item.title.trim(),
        settings: { ...item.settings, table: columnNames ? { ...table, columnNames } : table },
      };
    });
    if (!draft.name.trim()) {
      setToast({ text: '양식 이름을 입력해 주세요', variant: 'error' });
      return;
    }
    if (items.some((item) => !item.title)) {
      setToast({ text: '항목 제목을 입력해 주세요', variant: 'error' });
      return;
    }
    // 디자인 09 11/27: AI에게 알려 줄 설명은 필수. 빈 항목을 골라 왼쪽 항목 구성에서 바로 채우게 한다
    const emptyDescription = items.findIndex((item) => !item.description.trim());
    if (emptyDescription >= 0) {
      setSelectedIndex(emptyDescription);
      setView('items');
      setIsSideOpen(true);
      setToast({ text: 'AI에게 알려 줄 설명을 입력해 주세요', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const request = { ...draft, name: draft.name.trim(), items };
      if (editingId !== null) {
        await updateMinutesTemplate(editingId, request);
      } else {
        await createMinutesTemplate(request);
      }
      navigate('/templates', { state: { saved: true } });
    } catch (error) {
      // MSG-053 서버 오류, 네트워크 오류일 때만 정해 둔 문구를 쓴다
      const text = isApiError(error) && error.status < 500 ? errorMessage(error) : '양식을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
      setToast({ text, variant: 'error' });
      setIsSaving(false);
    }
  };

  // REQ-158 항목 구성이나 서식을 바꾼 상태면 초기화 전에 묻는다 (MSG-052). 이름, 설명은 그대로 둔다
  const defaultDraft = fromDefault(templates, draft.name, draft.description);
  const isDefaultShape = JSON.stringify(draft) === JSON.stringify(defaultDraft);
  const resetToDefault = () => {
    setDraft(defaultDraft);
    setSelectedIndex(0);
    setIsResetDialogOpen(false);
  };

  return (
    // QA 79 햄버거 버튼 대신 다른 화면처럼 왼쪽에 작은 사이드바를 둔다. 펼치면 전체 메뉴가 화면 위로 나온다
    <div className={styles.frame}>
      <aside className={styles.appRail}>
        <SidebarRail onExpand={() => setIsMenuOpen(true)} />
      </aside>
      {isMenuOpen && (
        <>
          <div className={editorBar.dim} aria-hidden="true" onClick={() => setIsMenuOpen(false)} />
          <aside className={editorBar.drawer} aria-label="메뉴">
            <Sidebar onCollapse={() => setIsMenuOpen(false)} />
          </aside>
        </>
      )}
    <div className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      {isResetDialogOpen && (
        <ConfirmDialog
          title="기본 양식으로 초기화할까요?"
          message="지금까지 바꾼 항목과 서식 설정이 기본값으로 돌아가요."
          cancelLabel="취소"
          confirmLabel="초기화"
          onCancel={() => setIsResetDialogOpen(false)}
          onConfirm={resetToDefault}
        />
      )}
      <EditorTopBar
        showMenuButton={false}
        center={
          <label className={styles.nameField}>
            <Icon src={templateIcon} size={BUTTON_ICON_SIZE} className={styles.nameIcon} />
            <input
              className={styles.nameInput}
              aria-label="양식 이름"
              maxLength={MAX_NAME_LENGTH}
              placeholder="양식 이름을 입력해 주세요"
              value={draft.name}
              disabled={!isLoaded}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
        }
        actions={
          <>
            <button
              type="button"
              className={`${editorBar.action} ${editorBar.secondary}`}
              disabled={!isLoaded}
              onClick={() => (isDefaultShape ? resetToDefault() : setIsResetDialogOpen(true))}
            >
              <Icon src={refreshIcon} size={BUTTON_ICON_SIZE} />
              초기화
            </button>
            <button
              type="button"
              className={`${editorBar.action} ${editorBar.primary}`}
              disabled={!isLoaded || isSaving}
              onClick={save}
            >
              {isSaving ? '저장 중' : '저장하기'}
            </button>
          </>
        }
      />

      {/* 양식을 다 받기 전에 입력하면 받은 내용이 덮어쓰므로 받은 뒤에 그린다 */}
      {!isLoaded && <p className={styles.loading}>양식을 불러오는 중이에요.</p>}
      {isLoaded && (
        <div className={styles.workspace}>
          <nav className={styles.rail} aria-label="양식 편집 메뉴">
            {RAIL.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={[styles.railItem, view === entry.value ? styles.railItemOn : ''].filter(Boolean).join(' ')}
                aria-pressed={view === entry.value}
                onClick={() => setView(entry.value)}
              >
                <Icon src={entry.icon} size={RAIL_ICON_SIZE} />
                {entry.label}
              </button>
            ))}
          </nav>

          <div className={[styles.sideWrap, isSideOpen ? '' : styles.sideClosed].filter(Boolean).join(' ')}>
          <div className={styles.side}>
            {view === 'items' ? (
              <section className={styles.itemsPanel} aria-label="항목 구성">
                {/* 디자인 09 TemplateDescriptionField (11/25): 한 줄 입력칸, 오른쪽 아래 글자 수 */}
                <label className={styles.field}>
                  <span className={styles.subLabel}>양식 설명</span>
                  <span className={styles.inputBox}>
                    <input
                      className={styles.input}
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      placeholder="어떤 회의에 쓰는 양식인지 적어 주세요"
                      value={draft.description}
                      onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </span>
                  <Counter length={draft.description.length} max={MAX_DESCRIPTION_LENGTH} />
                </label>
                <hr className={styles.divider} />
                {/* 디자인 09 "섹션 이름·AI 설명 고치기" (11/25): 선택한 항목의 이름과 AI 설명을 여기서 고친다 */}
                <div className={styles.field}>
                  <span className={styles.label}>선택한 항목</span>
                  <SectionSelect
                    titles={draft.items.map(({ title }) => title)}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                  />
                  <span className={styles.helper}>선택한 섹션의 이름과 설명을 바꿀 수 있어요.</span>
                </div>
                {selectedItem && selectedIndex !== null && (
                  <div className={styles.itemFields}>
                    <label className={styles.field}>
                      <span className={styles.subLabel}>
                        항목 이름<span className={styles.required}>*</span>
                      </span>
                      <span className={styles.inputBox}>
                        <input
                          className={styles.input}
                          maxLength={MAX_ITEM_TITLE_LENGTH}
                          placeholder="항목 이름을 입력해 주세요"
                          value={selectedItem.title}
                          onChange={(event) => updateSelected({ title: event.target.value })}
                        />
                      </span>
                      <Counter length={selectedItem.title.length} max={MAX_ITEM_TITLE_LENGTH} />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>
                        AI에게 알려 줄 설명<span className={styles.required}>*</span>
                      </span>
                      <span className={styles.aiBox}>
                        <textarea
                          className={styles.aiTextarea}
                          maxLength={MAX_ITEM_DESCRIPTION_LENGTH}
                          placeholder="AI가 이 섹션을 어떻게 채울지 적어 주세요"
                          value={selectedItem.description}
                          onChange={(event) => updateSelected({ description: event.target.value })}
                        />
                      </span>
                      <span className={styles.helper}>
                        {selectedItem.description.length} / {MAX_ITEM_DESCRIPTION_LENGTH}
                      </span>
                    </label>
                  </div>
                )}
                <hr className={styles.divider} />
                {/* 디자인 09 SectionListGroup (11/27): 항목 목록 대신 드롭다운 하나로 추가 */}
                <div className={styles.listGroup}>
                  <div className={styles.listHead}>
                    <h3 className={styles.listTitle}>회의록 항목</h3>
                    <p className={styles.panelDescription}>드롭다운에서 항목을 골라 회의록에 추가해요.</p>
                  </div>
                  <AddItemSelect
                    options={[
                      {
                        key: MEETING_INFO_PRESET.title,
                        title: MEETING_INFO_PRESET.title,
                        summary: MEETING_INFO_PRESET.summary,
                        isAdded: draft.layout.showMeetingInfo,
                      },
                      ...PRESET_ITEMS.map((preset) => ({
                        key: preset.title,
                        title: preset.title,
                        summary: preset.summary,
                        isAdded: presetIndexOf(preset) >= 0,
                      })),
                    ]}
                    onAdd={addPreset}
                    onAddCustom={addCustom}
                  />
                </div>
              </section>
            ) : (
              <TemplateSettingsPanel
                view={view}
                items={draft.items}
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                layout={draft.layout}
                onChangeItem={(item) =>
                  selectedIndex !== null && setItems(draft.items.map((current, index) => (index === selectedIndex ? item : current)))
                }
                onChangeLayout={(layout) => setDraft((prev) => ({ ...prev, layout }))}
              />
            )}
          </div>
            <button
              type="button"
              className={styles.collapseHandle}
              aria-label={isSideOpen ? '패널 접기' : '패널 펼치기'}
              aria-expanded={isSideOpen}
              onClick={() => setIsSideOpen((open) => !open)}
            >
              <Icon src={chevronLeftIcon} size={COLLAPSE_ICON_SIZE} className={isSideOpen ? '' : styles.collapseIconClosed} />
            </button>
          </div>

          <TemplatePreview
            name={draft.name}
            items={draft.items}
            layout={draft.layout}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onMove={moveItem}
            onRemove={removeItem}
          />
        </div>
      )}
    </div>
    </div>
  );
}
