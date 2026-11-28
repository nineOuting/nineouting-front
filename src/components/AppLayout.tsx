import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../assets/icons/logo.svg';
import Sidebar from './Sidebar';
import SidebarRail from './SidebarRail';
import TopBarUser from './TopBarUser';
import styles from './AppLayout.module.css';

const LOGO_WIDTH = 84;
const LOGO_HEIGHT = 16;

/**
 * 사이드 바 스크롤 위치. 공통 틀(AppShell) 안에서는 사이드 바가 그대로 남아 스크롤도 유지되지만,
 * 틀이 다른 화면(회의 대기)을 오가면 새로 만들어지므로 기억했다가 되돌린다
 */
let sidebarScrollTop = 0;

interface AppLayoutProps {
  children: ReactNode;
  /** compact: 회의 중 화면처럼 메뉴를 접은 채로 연다 */
  variant?: 'default' | 'compact';
  className?: string;
  /** 지금 보고 있는 워크스페이스 (왼쪽 메뉴에서 펼쳐 둔다) */
  workspaceId?: number;
  /** 로고·프로필 대신 화면이 직접 채우는 상단 바 (회의 대기 화면의 뒤로 가기, 회의 시작 버튼 등) */
  header?: ReactNode;
  /** 화면 높이에 맞춘다. 화면 전체 세로 스크롤 없이 본문 안쪽만 스크롤한다 (홈) */
  fitScreen?: boolean;
}

/** 로그인 후 화면 틀 (nep!nep! 디자인 Sidebar + TopBar). 메뉴를 접으면 상단 바 왼쪽에 메뉴 버튼이 생긴다 */
export default function AppLayout({ children, variant = 'default', className, workspaceId, header, fitScreen = false }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(variant === 'default');
  const { pathname } = useLocation();
  const layoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // 다른 화면으로 가면 본문은 맨 위부터 (틀이 남아 있으면 이전 화면의 스크롤 위치에서 열린다). 사이드 바는 따로 스크롤한다
  useLayoutEffect(() => {
    layoutRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // 사이드 바가 새로 만들어지면 기억한 위치로 (그리기 전에 맞춰 움직이는 게 보이지 않게)
  useLayoutEffect(() => {
    if (isSidebarOpen && sidebarRef.current) {
      sidebarRef.current.scrollTop = sidebarScrollTop;
    }
  }, [isSidebarOpen]);

  return (
    <div ref={layoutRef} className={[styles.layout, fitScreen ? styles.fitScreen : ''].filter(Boolean).join(' ')}>
      {isSidebarOpen ? (
        <aside
          ref={sidebarRef}
          className={styles.sidebar}
          onScroll={(event) => {
            sidebarScrollTop = event.currentTarget.scrollTop;
          }}
        >
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
          {header ?? (
            <>
              <div className={styles.brand}>
                <Link to="/home" aria-label="홈으로">
                  <img src={logo} alt="nep!nep!" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nepnep-logo" />
                </Link>
              </div>
              <TopBarUser />
            </>
          )}
        </header>
        <main className={[styles.main, className].filter(Boolean).join(' ')}>{children}</main>
      </div>
    </div>
  );
}
