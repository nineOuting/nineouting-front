import { useEffect, useState } from 'react';
import styles from './TooltipLayer.module.css';

const SHOW_DELAY_MS = 500;
const GAP_PX = 6;

interface Tip {
  text: string;
  left: number;
  top: number;
}

/** 아이콘만 있는 버튼인지: 보이는 글자 없이 aria-label만 있다 */
function iconButtonOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  const element = target.closest<HTMLElement>('button[aria-label], a[aria-label], [role="button"][aria-label]');
  if (!element || element.textContent?.trim()) {
    return null;
  }
  return element;
}

/**
 * REQ-181 툴팁: 아이콘만 있는 버튼에 마우스를 올리면 0.5초 뒤 버튼 이름(aria-label)을 보여 준다.
 * 화면마다 따로 붙이지 않고 앱에 하나만 둔다
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let timerId: number | undefined;
    let current: HTMLElement | null = null;

    const hide = () => {
      window.clearTimeout(timerId);
      current = null;
      setTip(null);
    };
    const handleOver = (event: MouseEvent) => {
      const element = iconButtonOf(event.target);
      if (element === current) {
        return;
      }
      hide();
      if (!element) {
        return;
      }
      current = element;
      timerId = window.setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setTip({ text: element.getAttribute('aria-label') ?? '', left: rect.left + rect.width / 2, top: rect.bottom + GAP_PX });
      }, SHOW_DELAY_MS);
    };

    document.addEventListener('mouseover', handleOver);
    document.addEventListener('mousedown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      document.removeEventListener('mouseover', handleOver);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);

  if (!tip?.text) {
    return null;
  }
  return (
    <span role="tooltip" className={styles.tooltip} style={{ left: tip.left, top: tip.top }}>
      {tip.text}
    </span>
  );
}
