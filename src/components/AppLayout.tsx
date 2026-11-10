import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/icons/logo.svg';
import Sidebar from './Sidebar';
import SidebarRail from './SidebarRail';
import TopBarUser from './TopBarUser';
import styles from './AppLayout.module.css';

const LOGO_WIDTH = 84;
const LOGO_HEIGHT = 16;

interface AppLayoutProps {
  children: ReactNode;
  /** compact: 회의 중 화면처럼 메뉴를 접은 채로 연다 */
  variant?: 'default' | 'compact';
  className?: string;
  /** 지금 보고 있는 워크스페이스 (왼쪽 메뉴에서 펼쳐 둔다) */
  workspaceId?: number;
}

/** 로그인 후 화면 틀 (nep!nep! 디자인 Sidebar + TopBar). 메뉴를 접으면 상단 바 왼쪽에 메뉴 버튼이 생긴다 */
export default function AppLayout({ children, variant = 'default', className, workspaceId }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(variant === 'default');

  return (
    <div className={styles.layout}>
      {isSidebarOpen ? (
        <aside className={styles.sidebar}>
          <Sidebar workspaceId={workspaceId} onCollapse={() => setIsSidebarOpen(false)} />
        </aside>
      ) : (
        // REQ-001 접으면 아이콘만 보이는 좁은 사이드바
        <aside className={`${styles.sidebar} ${styles.rail}`}>
          <SidebarRail workspaceId={workspaceId} onExpand={() => setIsSidebarOpen(true)} />
        </aside>
      )}
      <div className={styles.body}>
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <Link to="/home" aria-label="홈으로">
              <img src={logo} alt="nep!nep!" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nepnep-logo" />
            </Link>
          </div>
          <TopBarUser />
        </header>
        <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
      </div>
    </div>
  );
}
