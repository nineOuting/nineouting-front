import type { ReactNode } from 'react';
import clockIcon from '../../../assets/icons/clock.svg';
import errorIcon from '../../../assets/icons/error.svg';
import infoIcon from '../../../assets/icons/info.svg';
import pauseIcon from '../../../assets/icons/pause.svg';
import Icon from '../../../components/Icon';
import styles from './RoomBanner.module.css';

const ICON_SIZE = 16;

const ICONS = { info: infoIcon, danger: errorIcon, warning: clockIcon, neutral: pauseIcon } as const;

interface RoomBannerProps {
  tone: keyof typeof ICONS;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

/** 디자인 Version02 Live 가운데 위 알림 줄: AI 일시 중단(파랑), 인터넷 끊김(빨강), 예정 시간 초과(주황), 녹음 멈춤(회색) */
export default function RoomBanner({ tone, title, description, action }: RoomBannerProps) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon src={ICONS[tone]} size={ICON_SIZE} className={styles.icon} />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

interface SilenceNoticeProps {
  seconds: number;
  onDismiss: () => void;
  onCheckMic: () => void;
}

/** 디자인 Live_15 마이크 소리 없음: 녹음 중인데 한동안 전사가 오지 않으면 위에 뜨는 안내 */
export function SilenceNotice({ seconds, onDismiss, onCheckMic }: SilenceNoticeProps) {
  return (
    <div className={styles.popover} role="alertdialog" aria-labelledby="silence-title">
      <p id="silence-title" className={styles.popoverTitle}>
        <Icon src={errorIcon} size={ICON_SIZE} />
        {seconds}초째 소리가 들리지 않아요
      </p>
      <p className={styles.popoverText}>
        마이크가 음소거되어 있거나 다른 마이크가 선택됐을 수 있어요. 그동안 말한 내용은 기록되지 않아요.
      </p>
      <div className={styles.popoverActions}>
        <button type="button" className={styles.textButton} onClick={onDismiss}>
          괜찮아요
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onCheckMic}>
          마이크 확인
        </button>
      </div>
    </div>
  );
}
