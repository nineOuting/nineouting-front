import { useState } from 'react';
import closeIcon from '../../assets/icons/close-sm.svg';
import Icon from '../../components/Icon';
import styles from './OnboardingBar.module.css';

const CLOSE_ICON_SIZE = 16;
const DISMISS_KEY = 'nepnep-workspace-onboarding-closed';

export interface OnboardingStep {
  label: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
}

interface OnboardingBarProps {
  workspaceId: number;
  steps: OnboardingStep[];
}

function isDismissed(workspaceId: number) {
  try {
    return (localStorage.getItem(DISMISS_KEY) ?? '').split(',').includes(String(workspaceId));
  } catch {
    return false;
  }
}

/**
 * REQ-198 워크스페이스 시작하기 (피그마 Page 8 OnboardingChecklist): 소유자에게 남은 할 일을 한 줄로.
 * 멤버 초대 → 기본 양식 정하기 → 폴더 권한 정하기, 진행률. 다 하거나 X로 닫으면 보이지 않는다
 */
export default function OnboardingBar({ workspaceId, steps }: OnboardingBarProps) {
  const [isClosed, setIsClosed] = useState(() => isDismissed(workspaceId));
  const doneCount = steps.filter(({ done }) => done).length;
  const next = steps.find(({ done }) => !done);
  if (isClosed || !next) {
    return null;
  }

  const close = () => {
    setIsClosed(true);
    try {
      const closed = (localStorage.getItem(DISMISS_KEY) ?? '').split(',').filter(Boolean);
      localStorage.setItem(DISMISS_KEY, [...closed, String(workspaceId)].join(','));
    } catch {
      // 저장하지 못하면 다음에 한 번 더 보일 뿐이다
    }
  };

  return (
    <section className={styles.bar} aria-label="워크스페이스 시작하기">
      <p className={styles.title}>워크스페이스 시작하기</p>
      <span className={styles.progress}>
        <span
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <span className={styles.fill} style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </span>
        <span className={styles.progressText}>
          {doneCount}/{steps.length} 완료
        </span>
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <p className={styles.next}>
        <span className={styles.nextLabel}>남은 할 일</span>
        {next.label}
      </p>
      <button type="button" className={styles.action} onClick={next.onAction}>
        {next.actionLabel}
      </button>
      <button type="button" className={styles.close} aria-label="워크스페이스 시작하기 닫기" onClick={close}>
        <Icon src={closeIcon} size={CLOSE_ICON_SIZE} />
      </button>
    </section>
  );
}
