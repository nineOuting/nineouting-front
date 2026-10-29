import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { createMinutesTemplate, listMinutesTemplates, updateMinutesTemplate } from '../../api/minutes';
import Checkbox from '../../components/Checkbox';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { MinutesTemplate, TemplateItem, TemplateLayout } from '../../types/template';
import {
  DEFAULT_ITEM_SETTINGS,
  DEFAULT_LAYOUT,
  MEETING_INFO_PRESET,
  PRESET_ITEMS,
  presetItem,
} from '../../utils/templateSettings';
import TemplatePreview from './TemplatePreview';
import TemplateSettingsPanel from './TemplateSettingsPanel';
import styles from './TemplateEditorPage.module.css';

const ITEM_ICON_SIZE = 40;
const ADD_ICON_SIZE = 20;
const BUTTON_ICON_SIZE = 16;
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 100;
const CUSTOM_TITLE = '커스텀 항목';
const CUSTOM_DESCRIPTION = '추가로 논의가 필요한 사항을 자유롭게 작성해주세요';

interface Draft {
  name: string;
  description: string;
  items: TemplateItem[];
  layout: TemplateLayout;
}

const EMPTY_DRAFT: Draft = { name: '', description: '', items: [], layout: DEFAULT_LAYOUT };

/** 기본 양식의 항목·레이아웃 (기본 양식으로 초기화) */
function fromDefault(templates: MinutesTemplate[], name: string, description: string): Draft {
  const base = templates.find((template) => template.isDefault);
  return { name, description, items: base?.items ?? [], layout: base?.layout ?? DEFAULT_LAYOUT };
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
        if (editingId !== null && (!source || source.isDefault)) {
          setToast({ text: '고칠 수 없는 양식이에요.', variant: 'error' });
        }
        setDraft(
          source
            ? {
                name: editingId !== null ? source.name : `${source.name} 복사본`.slice(0, MAX_NAME_LENGTH),
                description: source.description,
                items: source.items,
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
  const indexOf = (title: string) => draft.items.findIndex((item) => item.title === title);
  const presetTitles = new Set(PRESET_ITEMS.map(({ title }) => title));
  const customItems = draft.items.filter((item) => !presetTitles.has(item.title));

  const togglePreset = (preset: (typeof PRESET_ITEMS)[number]) => {
    const index = indexOf(preset.title);
    if (index >= 0) {
      removeItem(index);
    } else {
      setItems([...draft.items, presetItem(preset)]);
      setSelectedIndex(draft.items.length);
    }
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
  const duplicateItem = () => {
    if (selectedIndex === null) {
      return;
    }
    const source = draft.items[selectedIndex];
    const next = [...draft.items];
    next.splice(selectedIndex + 1, 0, { ...source, title: uniqueTitle(draft.items, source.title) });
    setItems(next);
    setSelectedIndex(selectedIndex + 1);
  };

  const save = async () => {
    const items = draft.items.map((item) => ({ ...item, title: item.title.trim() }));
    if (!draft.name.trim()) {
      setToast({ text: '양식 이름을 입력해 주세요', variant: 'error' });
      return;
    }
    if (items.some((item) => !item.title)) {
      setToast({ text: '항목 제목을 입력해 주세요', variant: 'error' });
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
      setToast({ text: errorMessage(error), variant: 'error' });
      setIsSaving(false);
    }
  };

  const selected = selectedIndex !== null ? (draft.items[selectedIndex] ?? null) : null;

  return (
    <div className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <header className={styles.topBar}>
        <Link to="/home" className={styles.logo}>
          sync
        </Link>
      </header>
      <div className={styles.headBar}>
        <div className={styles.info}>
          <h1 className={styles.title}>회의록 양식 편집</h1>
          <p className={styles.description}>필요한 항목을 선택하고 순서를 바꿔 나만의 회의록 양식을 만들어보세요.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={!isLoaded}
            onClick={() => {
              setDraft((prev) => fromDefault(templates, prev.name, prev.description));
              setSelectedIndex(0);
            }}
          >
            <Placeholder size={BUTTON_ICON_SIZE} />
            기본 양식으로 초기화
          </button>
          <button type="button" className={styles.primary} disabled={!isLoaded || isSaving} onClick={save}>
            {isSaving ? '저장 중' : '저장하기'}
          </button>
        </div>
      </div>

      {/* 양식을 다 받기 전에 입력하면 받은 내용이 덮어쓰므로 받은 뒤에 그린다 */}
      {!isLoaded && <p className={styles.loading}>양식을 불러오는 중이에요.</p>}
      {isLoaded && (
        <div className={styles.content}>
          <section className={styles.left} aria-label="양식 구성">
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>양식 기본 정보</h2>
              <label className={styles.field}>
                <span className={styles.label}>양식 이름</span>
                <input
                  className={styles.input}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="양식 이름을 입력해 주세요"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>
                  설명 <span className={styles.optional}>(선택)</span>
                </span>
                <span className={styles.textareaBox}>
                  <textarea
                    className={styles.textarea}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    rows={1}
                    placeholder="어떤 회의에 쓰는 양식인지 적어 주세요"
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  />
                  <span className={styles.counter}>
                    {draft.description.length} / {MAX_DESCRIPTION_LENGTH}
                  </span>
                </span>
              </label>
            </div>

            <div className={styles.block}>
              <h2 className={styles.blockTitle}>회의록 항목 구성</h2>
              <div className={styles.items}>
                <Checkbox
                  className={styles.item}
                  checked={draft.layout.showMeetingInfo}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, layout: { ...prev.layout, showMeetingInfo: event.target.checked } }))
                  }
                >
                  <span className={styles.itemBody}>
                    <Placeholder size={ITEM_ICON_SIZE} />
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{MEETING_INFO_PRESET.title}</span>
                      <span className={styles.itemDescription}>{MEETING_INFO_PRESET.description}</span>
                    </span>
                  </span>
                </Checkbox>
                {PRESET_ITEMS.map((preset) => (
                  <Checkbox
                    key={preset.title}
                    className={styles.item}
                    checked={indexOf(preset.title) >= 0}
                    onChange={() => togglePreset(preset)}
                  >
                    <span className={styles.itemBody}>
                      <Placeholder size={ITEM_ICON_SIZE} />
                      <span className={styles.itemText}>
                        <span className={styles.itemTitle}>{preset.title}</span>
                        <span className={styles.itemDescription}>{preset.description}</span>
                      </span>
                    </span>
                  </Checkbox>
                ))}
                {customItems.map((item) => (
                  <Checkbox
                    key={item.title}
                    className={styles.item}
                    checked
                    onChange={() => removeItem(indexOf(item.title))}
                  >
                    <span className={styles.itemBody}>
                      <Placeholder size={ITEM_ICON_SIZE} />
                      <span className={styles.itemText}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <span className={styles.itemDescription}>{item.description}</span>
                      </span>
                    </span>
                  </Checkbox>
                ))}
              </div>
              <button type="button" className={styles.addCustom} onClick={addCustom}>
                <Placeholder size={ADD_ICON_SIZE} />
                커스텀 항목 추가
              </button>
            </div>
          </section>

          <TemplatePreview
            name={draft.name}
            items={draft.items}
            layout={draft.layout}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onChangeItem={(index, item) => setItems(draft.items.map((current, position) => (position === index ? item : current)))}
            onMove={moveItem}
            onAdd={addCustom}
            onDuplicate={duplicateItem}
            onRemove={removeItem}
          />

          <TemplateSettingsPanel
            item={selected}
            layout={draft.layout}
            canRemoveItem={draft.items.length > 1}
            onChangeItem={(item) =>
              selectedIndex !== null && setItems(draft.items.map((current, index) => (index === selectedIndex ? item : current)))
            }
            onRemoveItem={() => selectedIndex !== null && removeItem(selectedIndex)}
            onChangeLayout={(layout) => setDraft((prev) => ({ ...prev, layout }))}
          />
        </div>
      )}
    </div>
  );
}
