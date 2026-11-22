import { useEffect, useState } from 'react';
import { listMinutesTemplates } from '../../api/minutes';
// 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 회의록 기본 양식 고르기 창
// import { shareTemplateToWorkspace } from '../../api/minutes';
// import { changeDefaultTemplate } from '../../api/workspace';
// import Button from '../../components/Button';
// import Dialog from '../../components/Dialog';
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
// workspaceId, isOwner, onChanged, onError는 아래 레거시 창에서만 쓴다
export default function DefaultTemplateCard({ templateId }: DefaultTemplateCardProps) {
  const [templates, setTemplates] = useState<MinutesTemplate[]>([]);
  // 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 회의록 기본 양식 고르기 창
  // const [picked, setPicked] = useState<number | null>(null);
  // const [isSaving, setIsSaving] = useState(false);
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

  // 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 회의록 기본 양식 고르기 창
//   const save = async () => {
//     if (picked === null) {
//       return;
//     }
//     setIsSaving(true);
//     const next = picked === SERVICE_DEFAULT_TEMPLATE_ID ? null : picked;
//     const isMine = (id: number | null) => id !== null && templates.some((template) => template.templateId === id && !template.isDefault && !template.shared);
//     try {
//       // REQ-199 (2026-11-17): 내 양식을 기본 양식으로 정하면 이 워크스페이스 멤버 모두 쓰게 공유하고, 바꾸면 예전 공유를 거둔다
//       if (isMine(next) && next !== null) {
//         await shareTemplateToWorkspace(next, workspaceId, true);
//       }
//       await changeDefaultTemplate(workspaceId, next);
//       if (templateId !== null && templateId !== next && isMine(templateId)) {
//         await shareTemplateToWorkspace(templateId, workspaceId, false).catch(() => undefined);
//       }
//       onChanged(next);
//       setPicked(null);
//     } catch (error) {
//       onError(error);
//     } finally {
//       setIsSaving(false);
//     }
//   };

  return (
    // 피그마 Page 8 SummaryBar의 DefaultTemplate: "기본 양식 {이름} [변경]"
    <span className={styles.inline}>
      <span className={styles.label}>기본 양식</span>
      <span className={styles.name}>{name}</span>
      {/* 레거시 (2026-11-22, 피그마 프론트에 창 디자인이 없어 막음): 회의록 기본 양식 고르기 창
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
      */}
    </span>
  );
}
