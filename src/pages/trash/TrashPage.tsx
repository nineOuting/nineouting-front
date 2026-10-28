import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { listTrash, purgeTrashFolder, restoreTrashFolder, type TrashFolder } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Toast, { type ToastMessage } from '../../components/Toast';
import { formatDateTime } from '../../utils/meetingFormat';
import styles from './TrashPage.module.css';

const UNKNOWN_NAME = '알 수 없음';

/**
 * REQ-143 쓰레기통. 지금은 지운 폴더만 들어온다 (2026-10-28 결정).
 * 디자인이 없어 양식 목록 화면 모양을 따랐다 (docs/backlog.md)
 */
export default function TrashPage() {
  const { workspaceId } = useParams();
  const id = Number(workspaceId);
  const [folders, setFolders] = useState<TrashFolder[] | null>(null);
  const [purging, setPurging] = useState<TrashFolder | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    let isCurrent = true;
    listTrash(id)
      .then((items) => isCurrent && setFolders(items))
      .catch((error: unknown) => {
        if (isCurrent) {
          setFolders([]);
          setToast({ text: errorMessage(error), variant: 'error' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [id]);

  const run = async (folder: TrashFolder, action: () => Promise<void>, doneMessage: string) => {
    setBusyId(folder.folderId);
    try {
      await action();
      setFolders((prev) => prev && prev.filter(({ folderId }) => folderId !== folder.folderId));
      setToast({ text: doneMessage, variant: 'info' });
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const restore = (folder: TrashFolder) =>
    run(folder, () => restoreTrashFolder(id, folder.folderId), `'${folder.name}' 폴더를 복구했어요.`);

  const purge = (folder: TrashFolder) => {
    setPurging(null);
    return run(folder, () => purgeTrashFolder(id, folder.folderId), `'${folder.name}' 폴더를 영구 삭제했어요.`);
  };

  return (
    <AppLayout className={styles.page} workspaceId={id}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <div>
        <h1 className={styles.title}>쓰레기통</h1>
        <p className={styles.description}>
          삭제한 폴더는 3개월 동안 보관된 뒤 자동으로 영구 삭제돼요. 지운 사람과 워크스페이스 소유자가 복구할 수 있어요.
        </p>
      </div>
      {folders && folders.length === 0 && <p className={styles.empty}>쓰레기통이 비어 있어요.</p>}
      {folders && folders.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">폴더</th>
              <th scope="col">삭제한 사람</th>
              <th scope="col">삭제한 날</th>
              <th scope="col">영구 삭제 예정</th>
              <th scope="col">
                <span className={styles.hidden}>관리</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr key={folder.folderId}>
                <td className={styles.name}>{folder.name}</td>
                <td>{folder.deletedByName ?? UNKNOWN_NAME}</td>
                <td>{formatDateTime(folder.deletedAt)}</td>
                <td>{formatDateTime(folder.purgeAt)}</td>
                <td>
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={busyId === folder.folderId}
                      onClick={() => restore(folder)}
                    >
                      복구
                    </button>
                    <button
                      type="button"
                      className={`${styles.secondary} ${styles.danger}`}
                      disabled={busyId === folder.folderId}
                      onClick={() => setPurging(folder)}
                    >
                      영구 삭제
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {purging && (
        <ConfirmDialog
          title="폴더를 영구 삭제하시겠습니까?"
          message={'폴더 안의 회의와 회의록이 모두 함께 삭제되며\n되돌릴 수 없습니다.'}
          cancelLabel="취소"
          confirmLabel="영구 삭제"
          isDanger
          onCancel={() => setPurging(null)}
          onConfirm={() => purge(purging)}
        />
      )}
    </AppLayout>
  );
}
