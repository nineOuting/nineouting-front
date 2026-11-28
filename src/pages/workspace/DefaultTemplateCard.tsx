import { useState } from 'react';
import { setTemplateFavorite, setWorkspaceDefaultTemplate } from '../../api/minutes';
import type { MinutesTemplate } from '../../types/template';
import DefaultTemplateModal from './DefaultTemplateModal';
import styles from './DefaultTemplateCard.module.css';

// minutes-service가 처음부터 넣어 둔 서비스 기본 양식 (V5 마이그레이션)
const SERVICE_DEFAULT_TEMPLATE_ID = 1;

export type DefaultTemplateModalMode = 'change' | 'setup';

interface DefaultTemplateCardProps {
  workspaceId: number;
  /** null이면 서비스 기본 양식 */
  templateId: number | null;
  /** 양식 목록. 워크스페이스 화면이 다른 내용과 함께 불러와 넘긴다 (뒤늦게 받으면 이름이 바뀌어 보인다) */
  initialTemplates: MinutesTemplate[];
  isOwner: boolean;
  /** 열린 기본 양식 창 (시작하기 바에서도 연다). null이면 닫힘 */
  modalMode: DefaultTemplateModalMode | null;
  onModalModeChange: (mode: DefaultTemplateModalMode | null) => void;
  /** 정한 양식 id와 이름 (토스트 MSG-128) */
  onChanged: (templateId: number, name: string) => void;
  onError: (error: unknown) => void;
}

/**
 * REQ-199 워크스페이스 회의록 기본 양식: 이름과 [변경].
 * 소유자가 아니면 [변경]은 비활성이고 마우스를 올리면 툴팁 (피그마 11/24, MSG-129)
 */
export default function DefaultTemplateCard({
  workspaceId,
  templateId,
  initialTemplates,
  isOwner,
  modalMode,
  onModalModeChange,
  onChanged,
  onError,
}: DefaultTemplateCardProps) {
  const [templates, setTemplates] = useState<MinutesTemplate[]>(initialTemplates);
  const [isSaving, setIsSaving] = useState(false);
  const currentId = templateId ?? SERVICE_DEFAULT_TEMPLATE_ID;

  // 다른 멤버의 개인 양식은 목록에 없어 이름을 모른다
  const name = templates.find((template) => template.templateId === currentId)?.name ?? '워크스페이스 지정 양식';

  const save = async (picked: number) => {
    setIsSaving(true);
    try {
      // REQ-213 워크스페이스 양식함: 고른 양식을 워크스페이스 사본으로 만들고 그 사본을 기본 양식으로 정한다 (서버가 한 번에).
      // 서비스 기본 양식을 골라도 사본을 만들어 정하므로 시작하기 바의 "기본 양식 정하기"가 끝난 것으로 보인다 (피그마 11/24)
      const copy = await setWorkspaceDefaultTemplate(workspaceId, picked);
      // 이 워크스페이스의 예전 사본은 목록에서 빼고 새 사본을 넣는다
      setTemplates((prev) => [...prev.filter((template) => template.workspaceId !== workspaceId), copy]);
      onChanged(copy.templateId, copy.name);
      onModalModeChange(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  };

  // REQ-123 즐겨찾기는 나만 보는 표시. 실패하면 되돌린다
  const toggleFavorite = async (id: number) => {
    const target = templates.find((template) => template.templateId === id);
    if (!target) {
      return;
    }
    const flip = (favorite: boolean) =>
      setTemplates((prev) => prev.map((template) => (template.templateId === id ? { ...template, favorite } : template)));
    flip(!target.favorite);
    try {
      await setTemplateFavorite(id, !target.favorite);
    } catch (error) {
      flip(target.favorite);
      onError(error);
    }
  };

  return (
    // 피그마 Page 8 SummaryBar의 DefaultTemplate: "기본 양식 {이름} [변경]"
    <span className={styles.inline}>
      <span className={styles.label}>기본 양식</span>
      <span className={styles.name}>{name}</span>
      {isOwner ? (
        <button type="button" className={styles.change} onClick={() => onModalModeChange('change')}>
          변경
        </button>
      ) : (
        // 비활성 버튼은 마우스 이벤트가 없어 감싼 칸에 툴팁을 단다 (MSG-129)
        <span className={styles.tooltipAnchor}>
          <button type="button" className={styles.change} disabled aria-describedby="default-template-owner-only">
            변경
          </button>
          <span id="default-template-owner-only" role="tooltip" className={styles.tooltip}>
            기본 양식은 워크스페이스 소유자만 바꿀 수 있어요
          </span>
        </span>
      )}
      {modalMode && templates.length > 0 && (
        <DefaultTemplateModal
          // 다른 워크스페이스의 양식함 사본은 이 워크스페이스에서 고를 수 없다
          templates={templates.filter((template) => !template.workspaceId || template.workspaceId === workspaceId)}
          currentId={currentId}
          mode={modalMode}
          isSaving={isSaving}
          onToggleFavorite={(id) => void toggleFavorite(id)}
          onSubmit={(picked) => void save(picked)}
          onClose={() => onModalModeChange(null)}
        />
      )}
    </span>
  );
}
