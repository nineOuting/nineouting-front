import { useEffect, useState } from 'react';
import { listMinutesTemplates } from '../../api/minutes';
import { changeDefaultTemplate } from '../../api/workspace';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import type { MinutesTemplate } from '../../types/template';
import styles from './DefaultTemplateCard.module.css';

// minutes-service가 처음부터 넣어 둔 서비스 기본 양식 (V5 마이그레이션)
const SERVICE_DEFAULT_TEMPLATE_ID = 1;

interface DefaultTemplateCardProps {
  workspaceId: number;
  /** null이면 서비스 기본 양식 */
  templateId: number | null;
  isOwner: boolean;
  onChanged: (templateId: number | null) => void;
  onError: (error: unknown) => void;
}

/**
 * REQ-199 워크스페이스 회의록 기본 양식: 이름과 [변경] (워크스페이스 소유자만).
 * 새 회의를 만들면 이 양식이 먼저 골라지고, 회의마다 대기 화면에서 바꿀 수 있다
 */
export default function DefaultTemplateCard({ workspaceId, templateId, isOwner, onChanged, onError }: DefaultTemplateCardProps) {
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const currentId = templateId ?? SERVICE_DEFAULT_TEMPLATE_ID;

  useEffect(() => {
    let isCurrent = true;
    listMinutesTemplates()
      .then((items) => isCurrent && setTemplates(items))
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, []);

  // 다른 멤버의 개인 양식은 목록에 없어 이름을 모른다
  const name = templates.find((template) => template.templateId === currentId)?.name ?? '워크스페이스 지정 양식';

  const save = async () => {
    if (picked === null) {
      return;
    }
    setIsSaving(true);
    const next = picked === SERVICE_DEFAULT_TEMPLATE_ID ? null : picked;
    try {
      await changeDefaultTemplate(workspaceId, next);
      onChanged(next);
      setPicked(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // 피그마 Page 8 SummaryBar의 DefaultTemplate: "기본 양식 {이름} [변경]"
    <span className={styles.inline}>
      <span className={styles.label}>기본 양식</span>
      <span className={styles.name}>{name}</span>
      {isOwner && (
        <button id="default-template-change" type="button" className={styles.change} onClick={() => setPicked(currentId)}>
          변경
        </button>
      )}
      {picked !== null && (
        <Dialog
          title="회의록 기본 양식"
          description="새 회의를 만들면 이 양식이 먼저 골라져요. 회의마다 바꿀 수 있어요."
          width="md"
          onClose={() => setPicked(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="md" onClick={() => setPicked(null)}>
                취소
              </Button>
              <Button type="button" variant="primary" size="md" isLoading={isSaving} disabled={isSaving} onClick={() => void save()}>
                저장
              </Button>
            </>
          }
        >
          <ul className={styles.options} role="radiogroup" aria-label="회의록 양식">
            {templates.map((template) => (
              <li key={template.templateId}>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name="default-template"
                    checked={picked === template.templateId}
                    onChange={() => setPicked(template.templateId)}
                  />
                  {template.name}
                </label>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </span>
  );
}
