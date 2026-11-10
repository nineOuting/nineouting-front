import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { moveMeeting } from '../api/meeting';
import { listFolders } from '../api/workspace';
import folderIcon from '../assets/icons/folder-meta.svg';
import Button from './Button';
import Dialog from './Dialog';
import Icon from './Icon';
import styles from './MoveMeetingModal.module.css';

const ICON_SIZE = 16;

interface MoveMeetingModalProps {
  meetingId: number;
  title: string;
  workspaceId: number;
  currentFolderId: number;
  onMoved: (folderName: string) => void;
  onClose: () => void;
}

/** REQ-166, REQ-160 [다른 폴더로 이동]: 같은 워크스페이스의 들어갈 수 있는 폴더로 옮긴다 (회의록도 따라간다) */
export default function MoveMeetingModal({ meetingId, title, workspaceId, currentFolderId, onMoved, onClose }: MoveMeetingModalProps) {
  const [folders, setFolders] = useState<{ folderId: number; name: string }[] | null>(null);
  const [target, setTarget] = useState<number>();
  const [error, setError] = useState<string>();
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    listFolders(workspaceId)
      .then((items) => isCurrent && setFolders(items.filter(({ folderId }) => folderId !== currentFolderId)))
      .catch((caught: unknown) => {
        if (isCurrent) {
          setFolders([]);
          setError(errorMessage(caught));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [workspaceId, currentFolderId]);

  const move = async () => {
    const folder = folders?.find(({ folderId }) => folderId === target);
    if (!folder) {
      return;
    }
    setIsMoving(true);
    try {
      await moveMeeting(meetingId, folder.folderId);
      onMoved(folder.name);
    } catch (caught) {
      setError(errorMessage(caught));
      setIsMoving(false);
    }
  };

  return (
    <Dialog
      title="다른 폴더로 이동"
      description={`'${title}'을 옮길 폴더를 골라 주세요. 회의록도 함께 옮겨져요.`}
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" size="md" disabled={target === undefined || isMoving} onClick={() => void move()}>
            {isMoving ? '옮기는 중' : '이동'}
          </Button>
        </>
      }
    >
      {folders === null && <p className={styles.caption}>폴더를 불러오는 중이에요</p>}
      {folders?.length === 0 && !error && <p className={styles.caption}>옮길 수 있는 다른 폴더가 없어요</p>}
      {folders && folders.length > 0 && (
        <ul className={styles.list} role="radiogroup" aria-label="옮길 폴더">
          {folders.map((folder) => (
            <li key={folder.folderId}>
              <button
                type="button"
                role="radio"
                aria-checked={target === folder.folderId}
                className={target === folder.folderId ? `${styles.option} ${styles.selected}` : styles.option}
                onClick={() => setTarget(folder.folderId)}
              >
                <Icon src={folderIcon} size={ICON_SIZE} className={styles.icon} />
                {folder.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </Dialog>
  );
}
