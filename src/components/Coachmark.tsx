import { useEffect, useState } from 'react';
import Button from './Button';
import styles from './Coachmark.module.css';

const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 320;
const GAP_PX = 16;

export interface CoachmarkStep {
  /** 강조할 영역 (화면에 있는 요소의 id. 그 요소를 감싼 section을 강조한다) */
  targetId: string;
  text: string;
}

interface CoachmarkProps {
  steps: CoachmarkStep[];
  onFinish: () => void;
}

function rectOf(targetId: string) {
  const element = document.getElementById(targetId);
  return (element?.closest('section, aside') ?? element)?.getBoundingClientRect() ?? null;
}

/**
 * REQ-174 첫 사용 안내 (디자인 MeetingLiveOnboardingPage): 어둡게 덮고 한 영역씩 밝혀 설명한다.
 * [건너뛰기]는 늘 있고, 마지막 단계를 마치거나 건너뛰면 onFinish
 */
export default function Coachmark({ steps, onFinish }: CoachmarkProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];

  useEffect(() => {
    const update = () => setRect(rectOf(step.targetId));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.targetId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFinish]);

  if (!rect) {
    return null;
  }
  const isLast = index === steps.length - 1;
  // 강조 영역 오른쪽에 자리가 없으면 왼쪽, 그래도 없으면 안쪽 아래에 둔다
  const fitsRight = rect.right + GAP_PX + CARD_WIDTH < window.innerWidth;
  const fitsLeft = rect.left - GAP_PX - CARD_WIDTH > 0;
  const left = fitsRight ? rect.right + GAP_PX : fitsLeft ? rect.left - GAP_PX - CARD_WIDTH : rect.left + GAP_PX;
  const top = fitsRight || fitsLeft ? rect.top : rect.bottom - 200;

  return (
    <div className={styles.layer} role="dialog" aria-modal="true" aria-label="회의 화면 안내">
      <div
        className={styles.spotlight}
        style={{
          left: rect.left - SPOTLIGHT_PADDING,
          top: rect.top - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2,
        }}
      />
      <div className={styles.card} style={{ left, top: Math.max(GAP_PX, top), width: CARD_WIDTH }}>
        <p className={styles.text}>{step.text}</p>
        <div className={styles.footer}>
          <span className={styles.progress}>
            {index + 1}/{steps.length}
          </span>
          <span className={styles.buttons}>
            <Button variant="text" size="md" onClick={onFinish}>
              건너뛰기
            </Button>
            <Button variant="primary" size="md" onClick={() => (isLast ? onFinish() : setIndex(index + 1))}>
              {isLast ? '시작하기' : '다음'}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
