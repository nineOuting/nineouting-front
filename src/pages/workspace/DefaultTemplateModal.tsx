import { useState } from 'react';
import starFillIcon from '../../assets/icons/star-fill.svg';
import starOutlineIcon from '../../assets/icons/star-outline.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import type { MinutesTemplate } from '../../types/template';
import galleryStyles from '../meeting/TemplateGalleryModal.module.css';
import TemplatePaper, { PAPER_WIDTH } from '../meeting/TemplatePaper';
import TemplateThumbnail from '../meeting/TemplateThumbnail';
import styles from './DefaultTemplateCard.module.css';

const STAR_SIZE = 20;
// 디자인 Preview Page 76x100
const CARD_PAGE_WIDTH = 76;

interface DefaultTemplateModalProps {
  templates: MinutesTemplate[];
  /** 지금 워크스페이스 기본 양식 ("기본 양식" 배지, 처음 고른 카드) */
  currentId: number;
  /** change: SummaryBar [변경], setup: 시작하기 바 [기본 양식 정하기] */
  mode: 'change' | 'setup';
  isSaving: boolean;
  onToggleFavorite: (templateId: number) => void;
  onSubmit: (templateId: number) => void;
  onClose: () => void;
}

/**
 * REQ-198, 199 회의록 기본 양식 고르기 (피그마 03 워크스페이스 TemplateSelectModal, 11/24).
 * 바꾸기는 다른 양식을 골라야 버튼이 켜지고, 시작하기 바에서 열면 지금 양식 그대로여도 [이 양식으로 정하기]가 켜져 있다
 */
export default function DefaultTemplateModal({
  templates,
  currentId,
  mode,
  isSaving,
  onToggleFavorite,
  onSubmit,
  onClose,
}: DefaultTemplateModalProps) {
  const [pickedId, setPickedId] = useState(currentId);
  const isSetup = mode === 'setup';

  return (
    <Dialog
      title={isSetup ? '회의록 기본 양식 정하기' : '회의록 기본 양식 바꾸기'}
      description={
        isSetup
          ? "새 워크스페이스라 '기본 회의록'으로 자동으로 정해 뒀어요. 그대로 쓰거나 다른 양식을 골라 주세요."
          : '새 회의를 만들 때 먼저 선택될 양식이에요. 이미 만든 회의는 그대로예요.'
      }
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button
            size="md"
            isLoading={isSaving}
            disabled={isSaving || (!isSetup && pickedId === currentId)}
            onClick={() => onSubmit(pickedId)}
          >
            {isSetup ? '이 양식으로 정하기' : '기본 양식으로 정하기'}
          </Button>
        </>
      }
    >
      <ul className={galleryStyles.grid}>
        {templates.map((template) => {
          const isSelected = template.templateId === pickedId;
          return (
            <li
              key={template.templateId}
              className={[galleryStyles.item, isSelected ? galleryStyles.itemSelected : ''].filter(Boolean).join(' ')}
            >
              <button
                type="button"
                aria-label={`${template.name} 고르기`}
                aria-pressed={isSelected}
                className={galleryStyles.pick}
                onClick={() => setPickedId(template.templateId)}
              >
                <span className={`${galleryStyles.preview} ${styles.previewWithBadge}`}>
                  {template.items.length > 0 ? (
                    <span className={galleryStyles.page} aria-hidden="true">
                      <TemplatePaper
                        name={template.name}
                        items={template.items}
                        layout={template.layout}
                        scale={CARD_PAGE_WIDTH / PAPER_WIDTH}
                        tiny
                      />
                    </span>
                  ) : (
                    <TemplateThumbnail />
                  )}
                  {/* 피그마 DefaultTemplateBadge: 지금 기본 양식인 카드의 미리보기 오른쪽 아래 */}
                  {template.templateId === currentId && <span className={styles.badge}>기본 양식</span>}
                </span>
                <span className={galleryStyles.name}>{template.name}</span>
              </button>
              <button
                type="button"
                aria-label={template.favorite ? `${template.name} 즐겨찾기 해제` : `${template.name} 즐겨찾기`}
                aria-pressed={template.favorite}
                className={[galleryStyles.star, template.favorite ? galleryStyles.starOn : ''].filter(Boolean).join(' ')}
                onClick={() => onToggleFavorite(template.templateId)}
              >
                <Icon src={template.favorite ? starFillIcon : starOutlineIcon} size={STAR_SIZE} />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
