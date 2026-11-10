import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/icons/logo.svg';
import menuIcon from '../assets/icons/menu.svg';
import Icon from './Icon';
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

/** 회의록, 양식 편집 화면의 상단 바 (디자인 EditorTopBar). 왼쪽 메뉴 없이 편집에 집중한다 */
export default function EditorTopBar({ left, center, actions }: EditorTopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <Link to="/home" className={styles.iconButton} aria-label="홈으로">
            <Icon src={menuIcon} size={MENU_ICON_SIZE} />
          </Link>
          <img src={logo} alt="nep!nep!" width={LOGO_WIDTH} height={LOGO_HEIGHT} className="nepnep-logo" />
        </div>
        {left}
      </div>
      {center && <div className={styles.center}>{center}</div>}
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
