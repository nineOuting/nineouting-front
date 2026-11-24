import { useState } from 'react';
import starFillIcon from '../../assets/icons/star-fill.svg';
import starOutlineIcon from '../../assets/icons/star-outline.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import type { MinutesTemplate } from '../../types/meeting';
import styles from './TemplateGalleryModal.module.css';
import TemplatePaper, { PAPER_WIDTH } from './TemplatePaper';
import TemplateThumbnail from './TemplateThumbnail';

const STAR_SIZE = 20;
// 디자인 Preview Page 76x100
const CARD_PAGE_WIDTH = 76;

interface TemplateGalleryModalProps {
  templates: MinutesTemplate[];
  selectedId?: number;
  onOpenDetail: (index: number) => void;
  onToggleFavorite: (templateId: number) => void;
  onCreateTemplate: () => void;
  /** [이 양식 사용하기]. 없으면(편집 권한 없음) 버튼을 숨긴다 */
  onUse?: (templateId: number) => void;
  onClose: () => void;
}

/**
 * REQ-123 회의록 양식 전체보기 (디자인 TemplateSelectModal). 카드를 누르면 고르고, 고른 카드를 한 번 더 누르면 상세 보기.
 * 아래 [이 양식 사용하기]로 정한다 (디자인 체크 2026-11-19). 별을 누르면 즐겨찾기
 */
export default function TemplateGalleryModal({
  templates,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
  onCreateTemplate,
  onUse,
  onClose,
}: TemplateGalleryModalProps) {
  const [pickedId, setPickedId] = useState(selectedId);
  return (
    <Dialog
      title="회의록 양식 선택"
      description="회의 목적에 맞는 양식을 골라 주세요"
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCreateTemplate}>
            새 양식 만들기
          </Button>
          {onUse && (
            <Button size="md" disabled={pickedId === undefined} onClick={() => pickedId !== undefined && onUse(pickedId)}>
              이 양식 사용하기
            </Button>
          )}
        </>
      }
    >
      <ul className={styles.grid}>
        {templates.map((template, index) => {
          const isSelected = template.templateId === pickedId;
          return (
            <li key={template.templateId} className={[styles.item, isSelected ? styles.itemSelected : ''].filter(Boolean).join(' ')}>
              <button
                type="button"
                aria-label={isSelected ? `${template.name} 자세히 보기` : `${template.name} 고르기`}
                aria-pressed={isSelected}
                className={styles.pick}
                onClick={() => (isSelected ? onOpenDetail(index) : setPickedId(template.templateId))}
              >
                <span className={styles.preview}>
                  {/* 디자인 요청 (SCRUM-364): 카드에도 글자가 있는 실제 종이를 줄여 보여 준다. 양식 정보가 없으면 가짜 줄 */}
                  {template.items && template.layout ? (
                    <span className={styles.page} aria-hidden="true">
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
                </span>
                <span className={styles.name}>{template.name}</span>
              </button>
              <button
                type="button"
                aria-label={template.isFavorite ? `${template.name} 즐겨찾기 해제` : `${template.name} 즐겨찾기`}
                aria-pressed={template.isFavorite}
                className={[styles.star, template.isFavorite ? styles.starOn : ''].filter(Boolean).join(' ')}
                onClick={() => onToggleFavorite(template.templateId)}
              >
                <Icon src={template.isFavorite ? starFillIcon : starOutlineIcon} size={STAR_SIZE} />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
