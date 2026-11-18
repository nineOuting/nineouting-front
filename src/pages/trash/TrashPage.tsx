import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { listTrashMeetings, purgeMeeting, restoreMeeting } from '../../api/meeting';
import { listMyWorkspaces, listTrash, purgeTrashFolder, restoreTrashFolder } from '../../api/workspace';
import emptyCharacter from '../../assets/characters/empty.svg';
import folderIcon from '../../assets/icons/folder-meta.svg';
import minutesIcon from '../../assets/icons/minutes-doc.svg';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import SettingsLayout from '../settings/SettingsLayout';
import styles from './TrashPage.module.css';

const ICON_SIZE = 16;
const DAY_MS = 24 * 60 * 60 * 1000;
// 남은 기간이 이 날수 이하면 빨갛게 보인다
const URGENT_DAYS = 7;
const LOADING_ROWS = 3;

type Kind = 'folder' | 'minutes' | 'meeting';

interface TrashItem {
  key: string;
  kind: Kind;
  id: number;
  /** 폴더 복구, 영구 삭제에 쓴다 */
  workspaceId: number;
  name: string;
  location: string;
  deletedAt: string;
  purgeAt: string;
}

// 표 머리글. 비어 있을 때도 보인다 (디자인 11 상태 모음)
const COLUMNS = ['이름', '종류', '위치', '삭제한 날짜', '남은 기간'];

const KIND_LABELS: Record<Kind, string> = { folder: '폴더', minutes: '회의록', meeting: '회의' };

function daysLeft(purgeAt: string) {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / DAY_MS));
}

function formatDate(dateTime: string) {
  return dateTime.slice(0, 10).replaceAll('-', '.');
}

/** MSG-073 "회의록 N개를 복구했어요." 종류가 섞이면 개수만 */
function restoredMessage(items: TrashItem[]) {
  const kinds = new Set(items.map(({ kind }) => kind));
  const label = kinds.size === 1 ? `${KIND_LABELS[items[0].kind]} ` : '';
  return `${label}${items.length}개를 복구했어요.`;
}

/** 한 워크스페이스의 지운 폴더와 회의, 회의록. 폴더의 위치는 워크스페이스, 회의는 폴더 */
async function loadWorkspace(workspaceId: number, workspaceName: string): Promise<TrashItem[]> {
  const [folders, meetings] = await Promise.all([listTrash(workspaceId), listTrashMeetings(workspaceId)]);
  return [
    ...folders.map((folder) => ({
      key: `folder-${folder.folderId}`,
      kind: 'folder' as const,
      id: folder.folderId,
      workspaceId,
      name: folder.name,
      location: workspaceName,
      deletedAt: folder.deletedAt,
      purgeAt: folder.purgeAt,
    })),
    ...meetings.map((meeting) => ({
      key: `meeting-${meeting.meetingId}`,
      kind: meeting.hasMinutes ? ('minutes' as const) : ('meeting' as const),
      id: meeting.meetingId,
      workspaceId,
      name: meeting.title,
      location: meeting.folderName,
      deletedAt: meeting.deletedAt,
      purgeAt: meeting.purgeAt,
    })),
  ];
}

/**
 * REQ-143 삭제 목록 (디자인 Page 9 Trash_Modal, 설정 창 안). 내가 속한 모든 워크스페이스의 지운 폴더(workspace-service)와
 * 회의, 회의록(meeting-service)을 함께 보여 주고 골라서 복구하거나 영구 삭제한다. 3개월이 지나면 자동으로 영구 삭제된다
 */
export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPurging, setIsPurging] = useState<TrashItem[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isCurrent = true;
    listMyWorkspaces()
      .then((mine) => Promise.all(mine.map((workspace) => loadWorkspace(workspace.workspaceId, workspace.name))))
      .then((groups) => {
        if (isCurrent) {
          setItems(groups.flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
          setSelected(new Set());
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setItems([]);
          setToast({ text: errorMessage(error), variant: 'error' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const run = async (targets: TrashItem[], action: 'restore' | 'purge') => {
    setIsBusy(true);
    const done: string[] = [];
    let failure: unknown;
    for (const item of targets) {
      try {
        if (item.kind === 'folder') {
          await (action === 'restore'
            ? restoreTrashFolder(item.workspaceId, item.id)
            : purgeTrashFolder(item.workspaceId, item.id));
        } else {
          await (action === 'restore' ? restoreMeeting(item.id) : purgeMeeting(item.id));
        }
        done.push(item.key);
      } catch (error) {
        failure = error;
      }
    }
    setItems((prev) => prev && prev.filter((item) => !done.includes(item.key)));
    setSelected((prev) => new Set([...prev].filter((key) => !done.includes(key))));
    setIsBusy(false);
    if (failure) {
      setToast({ text: errorMessage(failure), variant: 'error' });
      return;
    }
    const finished = targets.filter((item) => done.includes(item.key));
    setToast({
      text: action === 'restore' ? restoredMessage(finished) : `${finished.length}개를 영구 삭제했어요.`,
      variant: 'success',
    });
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  const selectedItems = items?.filter((item) => selected.has(item.key)) ?? [];
  const isAllSelected = Boolean(items?.length) && selectedItems.length === items?.length;

  return (
    <SettingsLayout
      title="삭제 목록"
      description="삭제한 폴더, 회의, 회의록은 3개월 동안 보관된 뒤 영구 삭제돼요"
    >
      {toast && <Toast message={toast} onClose={closeToast} />}
      <div className={styles.card}>
        {items === null && (
          <div className={styles.loading}>
            {Array.from({ length: LOADING_ROWS }, (_, index) => (
              <Skeleton key={index} height={44} />
            ))}
          </div>
        )}
        {items?.length === 0 && (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.checkCell} aria-hidden="true" />
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                  <th scope="col" aria-hidden="true" />
                </tr>
              </thead>
            </table>
            <EmptyState character={emptyCharacter} title="삭제 목록이 비어 있어요" description="삭제한 항목은 3개월 동안 여기에 보관돼요" />
          </>
        )}
        {items && items.length > 0 && (
          <>
            <div className={styles.toolbar}>
              <span className={styles.selectedCount}>{selectedItems.length > 0 ? `${selectedItems.length}개 선택됨` : ''}</span>
              <span className={styles.bulk}>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={isBusy || selectedItems.length === 0}
                  onClick={() => void run(selectedItems, 'restore')}
                >
                  복구
                </button>
                <button
                  type="button"
                  className={styles.danger}
                  disabled={isBusy || selectedItems.length === 0}
                  onClick={() => setIsPurging(selectedItems)}
                >
                  영구 삭제
                </button>
              </span>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label="모두 선택"
                      checked={isAllSelected}
                      onChange={() => setSelected(isAllSelected ? new Set() : new Set(items.map((item) => item.key)))}
                    />
                  </th>
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                  <th scope="col">
                    <span className={styles.hidden}>복구</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const left = daysLeft(item.purgeAt);
                  return (
                    <tr key={item.key} className={selected.has(item.key) ? styles.selectedRow : undefined}>
                      <td className={styles.checkCell}>
                        <input
                          type="checkbox"
                          aria-label={`${item.name} 선택`}
                          checked={selected.has(item.key)}
                          onChange={() => toggle(item.key)}
                        />
                      </td>
                      <td>
                        <span className={styles.name}>
                          <Icon src={item.kind === 'folder' ? folderIcon : minutesIcon} size={ICON_SIZE} className={styles.mutedIcon} />
                          {item.name}
                        </span>
                      </td>
                      <td>
                        <span className={styles.kind}>{KIND_LABELS[item.kind]}</span>
                      </td>
                      <td className={styles.location}>{item.location}</td>
                      <td>{formatDate(item.deletedAt)}</td>
                      <td>
                        <span className={left <= URGENT_DAYS ? `${styles.days} ${styles.urgent}` : styles.days}>D-{left}</span>
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          type="button"
                          className={styles.textButton}
                          disabled={isBusy}
                          onClick={() => void run([item], 'restore')}
                        >
                          복구
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
      {isPurging && (
        <ConfirmDialog
          title={`${isPurging.length}개를 영구 삭제할까요?`}
          message="영구 삭제하면 다시 복구할 수 없어요"
          cancelLabel="취소"
          confirmLabel="영구 삭제"
          isDanger
          onCancel={() => setIsPurging(null)}
          onConfirm={() => {
            const targets = isPurging;
            setIsPurging(null);
            void run(targets, 'purge');
          }}
        />
      )}
    </SettingsLayout>
  );
}
