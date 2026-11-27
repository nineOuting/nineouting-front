import autoAwesomeIcon from '../assets/icons/auto-awesome.svg';
import Icon from './Icon';
import styles from './AiNoticeLabel.module.css';

const ICON_SIZE = 14;
const DEFAULT_LABEL = 'AI는 틀릴 수 있습니다. 중요한 내용은 확인해주세요';

interface AiNoticeLabelProps {
  /** text: 배경 없이 조용히 알릴 때. chip: 회색 둥근 바탕으로 조금 더 눈에 띄게 */
  variant?: 'text' | 'chip';
  label?: string;
  showIcon?: boolean;
  className?: string;
}

/**
 * 디자인 시스템 AiNoticeLabel (11/27 신규). AI가 만든 내용 근처에 붙여 AI 결과가 틀릴 수 있음을 짧게 알린다.
 * 영역(패널·섹션) 제목 옆이나 아래에 하나만 쓰고, 항목마다 붙이지 않는다
 */
export default function AiNoticeLabel({ variant = 'text', label = DEFAULT_LABEL, showIcon = true, className }: AiNoticeLabelProps) {
  return (
    <p className={[styles.label, styles[variant], className].filter(Boolean).join(' ')}>
      {showIcon && <Icon src={autoAwesomeIcon} size={ICON_SIZE} className={styles.icon} />}
      {label}
    </p>
  );
}
