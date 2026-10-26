import type { ReactNode } from 'react';
import Placeholder from './Placeholder';
import styles from './AppLayout.module.css';

const MENU_ICON_SIZE = 24;

interface AppLayoutProps {
  children: ReactNode;
  /** compact: 회의 중 화면처럼 메뉴를 접어 72px만 차지한다 */
  variant?: 'default' | 'compact';
  className?: string;
  /** 왼쪽 메뉴 맨 아래 (워크스페이스 삭제 등) */
  sidebarFooter?: ReactNode;
}

/** 로그인 후 화면 틀. 왼쪽 메뉴(REQ-001)·상단 바는 디자인이 나오기 전까지 자리만 잡는다 */
export default function AppLayout({ children, variant = 'default', className, sidebarFooter }: AppLayoutProps) {
  const isCompact = variant === 'compact';
  return (
    <div className={[styles.layout, isCompact ? styles.compact : ''].filter(Boolean).join(' ')}>
      <header className={styles.header}>{!isCompact && <span className={styles.logo}>sync</span>}</header>
      <aside className={styles.sidebar} aria-label="메뉴">
        {isCompact && <Placeholder size={MENU_ICON_SIZE} className={styles.menuIcon} />}
        {sidebarFooter && <div className={styles.sidebarFooter}>{sidebarFooter}</div>}
      </aside>
      <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
