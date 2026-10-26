import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { deleteMinutesTemplate, listMinutesTemplates } from '../../api/minutes';
import AppLayout from '../../components/AppLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { MinutesTemplate } from '../../types/template';
import styles from './TemplateListPage.module.css';

const ICON_SIZE = 40;
const BUTTON_ICON_SIZE = 16;
const SAVED_MESSAGE = '양식을 저장했어요.';

/**
 * REQ-119~121 회의록 양식 목록 (왼쪽 메뉴의 회의록 템플릿). 디자인이 없어 카드 목록으로 간단히 만들었다 (docs/backlog.md).
 * 기본 양식은 고칠 수 없어 복사해서 새 양식을 만든다
 */
export default function TemplateListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [deleting, setDeleting] = useState<MinutesTemplate | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(() =>
    (location.state as { saved?: boolean } | null)?.saved ? { text: SAVED_MESSAGE, variant: 'info' } : null,
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

  const remove = async (template: MinutesTemplate) => {
    try {
      await deleteMinutesTemplate(template.templateId);
      setTemplates((prev) => prev.filter(({ templateId }) => templateId !== template.templateId));
      setToast({ text: '양식을 삭제했어요.', variant: 'info' });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>회의록 템플릿</h1>
          <p className={styles.description}>회의록에 쓸 양식을 만들고 관리해요. 이미 만든 회의록은 양식을 고쳐도 그대로예요.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => navigate('/templates/new')}>
          <Placeholder size={BUTTON_ICON_SIZE} />새 양식 만들기
        </button>
      </div>
      <ul className={styles.grid}>
        {templates.map((template) => (
          <li key={template.templateId} className={styles.card}>
            <div className={styles.cardHead}>
              <Placeholder size={ICON_SIZE} />
              <div className={styles.names}>
                <p className={styles.name}>
                  {template.name}
                  {template.isDefault && <span className={styles.badge}>기본</span>}
                </p>
                {template.description && <p className={styles.cardDescription}>{template.description}</p>}
              </div>
            </div>
            <p className={styles.items}>{template.items.map(({ title }) => title).join(' · ')}</p>
            <div className={styles.cardActions}>
              {template.isDefault ? (
                <button type="button" className={styles.secondary} onClick={() => navigate(`/templates/new?from=${template.templateId}`)}>
                  복사해서 만들기
                </button>
              ) : (
                <>
                  <button type="button" className={styles.secondary} onClick={() => navigate(`/templates/${template.templateId}/edit`)}>
                    편집
                  </button>
                  <button type="button" className={styles.secondary} onClick={() => navigate(`/templates/new?from=${template.templateId}`)}>
                    복사
                  </button>
                  <button type="button" className={`${styles.secondary} ${styles.danger}`} onClick={() => setDeleting(template)}>
                    삭제
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {deleting && (
        <ConfirmDialog
          title={`${deleting.name} 양식을 삭제할까요?`}
          message="이미 이 양식으로 만든 회의록은 그대로 남아요."
          cancelLabel="취소"
          confirmLabel="삭제"
          isDanger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </AppLayout>
  );
}
