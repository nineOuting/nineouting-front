import { useRef, useState } from 'react';
import addIcon from '../../../assets/icons/add-sm.svg';
import deleteIcon from '../../../assets/icons/delete-sm.svg';
import editIcon from '../../../assets/icons/edit.svg';
import Icon from '../../../components/Icon';
import type { AgendaStatus, RoomAgenda } from '../../../types/meetingRoom';
import ActionMenu from '../../workspace/ActionMenu';
import styles from './AgendaNav.module.css';

const ICON_SIZE = 16;

const STATUS_LABELS: Record<AgendaStatus, string> = {
  decided: '결정',
  discussing: '논의 중',
  undecided: '미결',
  notStarted: '논의 전',
  decisionCheck: '확인 필요',
};

interface AgendaNavProps {
  agendas: RoomAgenda[];
  selectedAgendaId: string;
  currentAgendaId?: string;
  onSelect: (agendaId: string) => void;
  /** 넘기면 회의록 작성자가 안건을 더하고, 이름을 바꾸고, 지운다 (REQ-172~173) */
  onAdd?: () => void;
  onRename?: (agendaId: string) => void;
  onDelete?: (agendaId: string) => void;
}

/**
 * 디자인 Version02 Live 왼쪽 "오늘의 안건": 안건마다 진행 상태를 세로 줄로 보여 주고, 누르면 가운데에 그 안건을 연다.
 * 피그마 프론트 "회의 중 안건 메뉴" (REQ-173): 회의록 작성자가 안건을 누르면 [안건 수정하기] [안건 삭제] 메뉴도 열린다
 */
export default function AgendaNav({
  agendas,
  selectedAgendaId,
  currentAgendaId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: AgendaNavProps) {
  const decidedCount = agendas.filter(({ status }) => status === 'decided').length;
  const [menuAgendaId, setMenuAgendaId] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const hasMenu = Boolean(onRename || onDelete);

  return (
    <nav className={styles.nav} aria-labelledby="agenda-status-title">
      <div className={styles.head}>
        <h2 id="agenda-status-title" className={styles.title}>
          오늘의 안건
        </h2>
        <span className={styles.count}>
          {agendas.length}개 중 {decidedCount}개 결정
        </span>
        {onAdd && (
          <button type="button" className={styles.iconButton} aria-label="안건 추가" onClick={onAdd}>
            <Icon src={addIcon} size={ICON_SIZE} />
          </button>
        )}
      </div>
      <ol className={styles.list}>
        {agendas.map((agenda) => {
          const isCurrent = agenda.id === currentAgendaId;
          const status: AgendaStatus = isCurrent ? 'discussing' : agenda.status;
          return (
            <li
              key={agenda.id}
              className={[styles.item, styles[status], agenda.id === selectedAgendaId ? styles.selected : '']
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.dot} aria-hidden="true" />
              <button
                type="button"
                className={styles.button}
                aria-current={agenda.id === selectedAgendaId ? 'true' : undefined}
                ref={menuAgendaId === agenda.id ? menuAnchorRef : undefined}
                aria-haspopup={hasMenu ? 'menu' : undefined}
                aria-expanded={hasMenu ? menuAgendaId === agenda.id : undefined}
                onClick={() => {
                  onSelect(agenda.id);
                  if (hasMenu) {
                    setMenuAgendaId((current) => (current === agenda.id ? null : agenda.id));
                  }
                }}
              >
                <span className={styles.status}>{STATUS_LABELS[status]}</span>
                <span className={styles.agendaTitle}>{agenda.title}</span>
              </button>
              {menuAgendaId === agenda.id && (
                <ActionMenu
                  label={`${agenda.title} 메뉴`}
                  anchorRef={menuAnchorRef}
                  className={styles.menu}
                  onClose={() => setMenuAgendaId(null)}
                  items={[
                    ...(onRename ? [{ label: '안건 수정하기', icon: editIcon, onSelect: () => onRename(agenda.id) }] : []),
                    ...(onDelete && agendas.length > 1
                      ? [{ label: '안건 삭제', icon: deleteIcon, isDanger: true, onSelect: () => onDelete(agenda.id) }]
                      : []),
                  ].map((item) => ({
                    ...item,
                    onSelect: () => {
                      setMenuAgendaId(null);
                      item.onSelect();
                    },
                  }))}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
