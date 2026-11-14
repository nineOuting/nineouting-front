import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { createMinutesTemplate, deleteMinutesTemplate, listMinutesTemplates, setTemplateFavorite } from '../../api/minutes';
import addIcon from '../../assets/icons/add-sm.svg';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import editIcon from '../../assets/icons/edit.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import starFillIcon from '../../assets/icons/star-fill.svg';
import starOutlineIcon from '../../assets/icons/star-outline.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import AppLayout from '../../components/AppLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { MinutesTemplate } from '../../types/template';
import ActionMenu from '../workspace/ActionMenu';
import TemplateImportModal from './TemplateImportModal';
import styles from './TemplateListPage.module.css';

const BUTTON_ICON_SIZE = 16;
const ICON_SIZE = 20;
const SAVED_MESSAGE = '양식을 저장했어요.';
const NAME_MAX_LENGTH = 100;

type SortOrder = 'recent' | 'name';

interface TemplateCardProps {
  template: MinutesTemplate;
  onToggleFavorite: () => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
}

/** 디자인 Version02 TemplateCard: 위 미리보기(회색 바탕 위 종이) + 즐겨찾기, 아래 이름·설명·구분 + 더보기 메뉴 */
function TemplateCard({ template, onToggleFavorite, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const menuItems = template.isDefault
    ? [{ label: '복제해서 내 양식 만들기', icon: copyIcon, onSelect: onDuplicate }]
    : [
        ...(onEdit ? [{ label: '수정', icon: editIcon, onSelect: onEdit }] : []),
        { label: '복제', icon: copyIcon, onSelect: onDuplicate },
        ...(onDelete ? [{ label: '삭제', icon: deleteIcon, isDanger: true, onSelect: onDelete }] : []),
      ];

  return (
    <li className={styles.card}>
      <button
        type="button"
        className={styles.preview}
        aria-label={`${template.name} ${template.isDefault ? '복제해서 만들기' : '수정'}`}
        onClick={template.isDefault ? onDuplicate : onEdit}
      >
        <span className={styles.paper} aria-hidden="true">
          <span className={styles.paperTitle} />
          {template.items.slice(0, 6).map((item, index) => (
            <span key={`${item.title}-${index}`} className={styles.paperLine} />
          ))}
        </span>
      </button>
      <button
        type="button"
        className={styles.favorite}
        aria-label={template.favorite ? `${template.name} 즐겨찾기 해제` : `${template.name} 즐겨찾기`}
        aria-pressed={template.favorite}
        onClick={onToggleFavorite}
      >
        <Icon src={template.favorite ? starFillIcon : starOutlineIcon} size={ICON_SIZE} />
      </button>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <p className={styles.name}>{template.name}</p>
          <div className={styles.menuAnchor}>
            <button
              ref={menuAnchorRef}
              type="button"
              className={styles.iconButton}
              aria-label={`${template.name} 더보기`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <Icon src={moreIcon} size={ICON_SIZE} />
            </button>
            {isMenuOpen && (
              <ActionMenu
                label={`${template.name} 메뉴`}
                anchorRef={menuAnchorRef}
                className={styles.cardMenu}
                items={menuItems.map((item) => ({
                  ...item,
                  onSelect: () => {
                    closeMenu();
                    item.onSelect();
                  },
                }))}
                onClose={closeMenu}
              />
            )}
          </div>
        </div>
        <p className={styles.description}>
          {template.description || template.items.map(({ title }) => title).join(', ')}
        </p>
        <p className={styles.metaRow}>
          <span className={[styles.kind, template.isDefault ? styles.kindDefault : ''].filter(Boolean).join(' ')}>
            {template.isDefault ? '기본 양식' : '내 양식'}
          </span>
          <span className={styles.meta}>
            {template.isDefault ? '기본 제공' : `항목 ${template.items.length}개`}
          </span>
        </p>
      </div>
    </li>
  );
}

/**
 * REQ-119~121, 123 디자인 Version02 TemplateListPage: 기본 양식과 내 양식을 나눠 미리보기 카드로 보여 준다.
 * 기본 양식은 고칠 수 없어 복제해서 내 양식을 만든다
 */
export default function TemplateListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // null이면 불러오는 중
  const [templates, setTemplates] = useState<MinutesTemplate[] | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [deleting, setDeleting] = useState<MinutesTemplate | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(() =>
    (location.state as { saved?: boolean } | null)?.saved ? { text: SAVED_MESSAGE, variant: 'success' } : null,
  );
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isCurrent = true;
    listMinutesTemplates()
      .then((list) => isCurrent && setTemplates(list))
      .catch((error: unknown) => isCurrent && setToast({ text: errorMessage(error), variant: 'error' }));
    return () => {
      isCurrent = false;
    };
  }, []);

  const replace = (templateId: number, patch: Partial<MinutesTemplate>) =>
    setTemplates((prev) => prev && prev.map((one) => (one.templateId === templateId ? { ...one, ...patch } : one)));

  /** REQ-123 즐겨찾기는 바로 반영하고 실패하면 되돌린다 */
  const toggleFavorite = async (template: MinutesTemplate) => {
    replace(template.templateId, { favorite: !template.favorite });
    try {
      await setTemplateFavorite(template.templateId, !template.favorite);
    } catch (error) {
      replace(template.templateId, { favorite: template.favorite });
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  /** 디자인 TemplateListPage_Duplicated: 바로 "OOO 복사본"을 내 양식으로 만든다 */
  const duplicate = async (template: MinutesTemplate) => {
    try {
      const copied = await createMinutesTemplate({
        name: `${template.name} 복사본`.slice(0, NAME_MAX_LENGTH),
        description: template.description,
        items: template.items,
        layout: template.layout,
      });
      setTemplates((prev) => prev && [...prev, copied]);
      setToast({
        text: `'${copied.name}'을 만들었어요`,
        variant: 'success',
        action: { label: '수정하기', onClick: () => navigate(`/templates/${copied.templateId}/edit`) },
      });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  const remove = async (template: MinutesTemplate) => {
    try {
      await deleteMinutesTemplate(template.templateId);
      setTemplates((prev) => prev && prev.filter(({ templateId }) => templateId !== template.templateId));
      setToast({ text: '양식을 삭제했어요.', variant: 'info' });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const sorted = [...(templates ?? [])].sort((a, b) =>
    sortOrder === 'name' ? a.name.localeCompare(b.name, 'ko') : b.templateId - a.templateId,
  );
  const defaults = sorted.filter(({ isDefault }) => isDefault);
  const mine = sorted.filter(({ isDefault }) => !isDefault);

  const renderCard = (template: MinutesTemplate) => (
    <TemplateCard
      key={template.templateId}
      template={template}
      onToggleFavorite={() => void toggleFavorite(template)}
      onEdit={template.isDefault ? undefined : () => navigate(`/templates/${template.templateId}/edit`)}
      onDuplicate={() => void duplicate(template)}
      onDelete={template.isDefault ? undefined : () => setDeleting(template)}
    />
  );

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>회의록 양식</h1>
          <p className={styles.subtitle}>회의록 양식을 만들고, 수정하거나 관리할 수 있어요.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setIsImportOpen(true)}>
            <Icon src={uploadIcon} size={ICON_SIZE} />
            양식 가져오기
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => navigate('/templates/new')}>
            <Icon src={addIcon} size={BUTTON_ICON_SIZE} />
            새 양식 만들기
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <p className={styles.count}>{templates ? `${templates.length}개의 양식` : ''}</p>
        <select
          className={styles.sort}
          aria-label="양식 정렬"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as SortOrder)}
        >
          <option value="recent">최신순</option>
          <option value="name">이름순</option>
        </select>
      </div>

      {/* REQ-178 불러오는 동안 회색 자리 (디자인 TemplateListPage_Loading) */}
      {templates === null && (
        <div className={styles.grid}>
          <Skeleton height={266} />
          <Skeleton height={266} />
          <Skeleton height={266} />
        </div>
      )}

      {defaults.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>기본 양식</h2>
          <ul className={styles.grid}>{defaults.map(renderCard)}</ul>
        </section>
      )}

      {templates && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>내 양식</h2>
          {mine.length > 0 ? (
            <ul className={styles.grid}>{mine.map(renderCard)}</ul>
          ) : (
            <p className={styles.empty}>아직 만든 양식이 없어요. 기본 양식을 복제하거나 새 양식을 만들어 보세요.</p>
          )}
        </section>
      )}

      {deleting && (
        <ConfirmDialog
          title={`'${deleting.name}' 양식을 삭제할까요?`}
          message="이미 이 양식으로 만든 회의록은 그대로 남아요."
          cancelLabel="취소"
          confirmLabel="삭제"
          isDanger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
      {isImportOpen && <TemplateImportModal onClose={() => setIsImportOpen(false)} />}
    </AppLayout>
  );
}
