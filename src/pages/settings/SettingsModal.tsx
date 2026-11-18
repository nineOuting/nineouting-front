import brightnessIcon from '../../assets/icons/brightness.svg';
import cardIcon from '../../assets/icons/card.svg';
import closeIcon from '../../assets/icons/close.svg';
import helpIcon from '../../assets/icons/nav-help.svg';
import profileIcon from '../../assets/icons/nav-profile.svg';
import trashIcon from '../../assets/icons/nav-trash.svg';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import TrashPage from '../trash/TrashPage';
import DisplaySettingsPage from './DisplaySettingsPage';
import HelpPage from './HelpPage';
import PlanPage from './PlanPage';
import ProfilePage from './ProfilePage';
import { useSettingsModal, type SettingsTab } from './useSettingsModal';
import styles from './SettingsModal.module.css';

const ICON_SIZE = 20;
const CLOSE_ICON_SIZE = 24;

// 디자인 메뉴: 프로필, 요금제, 화면 | 삭제 목록, 도움말 (가운데 구분선)
const MENU: { tab: SettingsTab; label: string; icon: string }[][] = [
  [
    { tab: 'profile', label: '프로필', icon: profileIcon },
    { tab: 'plan', label: '요금제', icon: cardIcon },
    { tab: 'display', label: '화면', icon: brightnessIcon },
  ],
  [
    { tab: 'trash', label: '삭제 목록', icon: trashIcon },
    // REQ-212 설정 창 도움말 (2026-11-18 시트)
    { tab: 'help', label: '도움말', icon: helpIcon },
  ],
];

const PANELS: Record<SettingsTab, () => React.JSX.Element> = {
  profile: ProfilePage,
  plan: PlanPage,
  display: DisplaySettingsPage,
  trash: TrashPage,
  help: HelpPage,
};

/**
 * REQ-145 설정 창 (디자인 Page 9 11 설정 Profile_Modal 등). 보던 화면 위에 뜨고 왼쪽 메뉴로 내용을 바꾼다.
 * 주소의 ?settings=탭이 있을 때만 그린다 (RootLayout)
 */
export default function SettingsModal() {
  const { tab, open, close } = useSettingsModal();
  if (!tab) {
    return null;
  }
  const Panel = PANELS[tab];

  return (
    <Modal labelledBy="settings-modal-title" onClose={close} className={styles.modal}>
      <div className={styles.header}>
        <h1 id="settings-modal-title" className={styles.title}>
          설정
        </h1>
        <button type="button" className={styles.close} aria-label="설정 닫기" onClick={close}>
          <Icon src={closeIcon} size={CLOSE_ICON_SIZE} />
        </button>
      </div>
      <div className={styles.body}>
        <nav className={styles.nav} aria-label="설정 메뉴">
          {MENU.map((group, index) => (
            <div key={index} className={styles.group}>
              {group.map((item) => (
                <button
                  key={item.tab}
                  type="button"
                  className={[styles.navItem, item.tab === tab ? styles.selected : ''].filter(Boolean).join(' ')}
                  aria-current={item.tab === tab ? 'page' : undefined}
                  onClick={() => open(item.tab, { replace: true })}
                >
                  <Icon src={item.icon} size={ICON_SIZE} className={styles.icon} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.content}>
          <Panel />
        </div>
      </div>
    </Modal>
  );
}
