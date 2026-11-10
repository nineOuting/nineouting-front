import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/icons/logo.svg';
import menuIcon from '../assets/icons/menu.svg';
import Icon from './Icon';
import Sidebar from './Sidebar';
import TopBarUser from './TopBarUser';
import styles from './EditorTopBar.module.css';

const LOGO_WIDTH = 84;
const LOGO_HEIGHT = 16;
const MENU_ICON_SIZE = 24;

interface EditorTopBarProps {
  /** 로고 오른쪽 (되돌리기 등) */
  left?: ReactNode;
  /** 가운데 (양식 이름 입력칸 등) */
  center?: ReactNode;
  /** 오른쪽 버튼들 (임시저장, 작성 완료 등) */
  actions?: ReactNode;
}

/**
 * 회의록, 양식 편집 화면의 상단 바 (디자인 EditorTopBar). 평소에는 왼쪽 메뉴 없이 편집에 집중하고,
 * 메뉴 버튼을 누르면 왼쪽 메뉴가 화면 위로 나온다. 로고를 누르면 홈으로 간다
 */
export default function EditorTopBar({ left, center, actions }: EditorTopBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <Icon src={menuIcon} size={MENU_ICON_SIZE} />
          </button>
          <Link to="/home" aria-label="홈으로" className={styles.logoLink}>
            <img src={logo} alt="nep!nep!" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nepnep-logo" />
          </Link>
        </div>
        {left}
      </div>
      {center && <div className={styles.center}>{center}</div>}
      <div className={styles.right}>
        <TopBarUser />
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {isMenuOpen && (
        <>
          <div className={styles.dim} aria-hidden="true" onClick={() => setIsMenuOpen(false)} />
          <aside className={styles.drawer} aria-label="메뉴">
            <Sidebar onCollapse={() => setIsMenuOpen(false)} />
          </aside>
        </>
      )}
    </header>
  );
}
