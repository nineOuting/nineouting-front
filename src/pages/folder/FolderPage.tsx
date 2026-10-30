import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { listFolderMeetingRows, listFolderPendingAgendas } from '../../api/meeting';
import {
  addFolderMember,
  getFolder,
  getWorkspace,
  leaveFolder,
  listFolderMemberDetails,
  listWorkspaceMembers,
  removeFolderMember,
  type FolderInfo,
} from '../../api/workspace';
import dividerPending from '../../assets/divider-pending.svg';
import dividerPendingMeta from '../../assets/divider-pending-meta.svg';
import AppLayout from '../../components/AppLayout';
import AvatarStack from '../../components/AvatarStack';
import ConfirmDialog from '../../components/ConfirmDialog';
import FavoriteButton from '../../components/FavoriteButton';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { FolderMeeting, FolderMember, FolderPendingAgenda, WorkspaceMember } from '../../types/workspace';
import FolderMembersModal from './FolderMembersModal';
import MeetingTable from './MeetingTable';
import styles from './FolderPage.module.css';

const SMALL_ICON_SIZE = 16;
const TITLE_ICON_SIZE = 20;
const PENDING_DIVIDER_WIDTH = 208;
const PENDING_META_DIVIDER_LENGTH = 17;

type Dialog = { type: 'members' } | { type: 'leave' };

/** 회의 상태에 따라 대기 화면·회의방·회의록으로 간다 */
function meetingPath({ meetingId, status }: FolderMeeting) {
  if (status === 'inProgress') {
    return `/meetings/${meetingId}/room`;
  }
  return status === 'scheduled' ? `/meetings/${meetingId}` : `/meetings/${meetingId}/minutes`;
}

/**
 * REQ-041~058, 139 프로젝트 폴더 화면 (회의 목록·멤버·남은 안건).
 * 디자인에는 하위 폴더와 [새 폴더]가 있지만 기획서 REQ-040 "폴더 안에 폴더는 불가능"에 따라
 * workspace-service가 만들지 않으므로(FOLDER_DEPTH_EXCEEDED) 화면에서 뺐다 (docs/backlog.md)
 */
export default function FolderPage() {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const id = Number(folderId);
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [meetings, setMeetings] = useState<FolderMeeting[]>([]);
  const [members, setMembers] = useState<FolderMember[]>([]);
  const [pendingAgendas, setPendingAgendas] = useState<FolderPendingAgenda[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[] | null>(null);
  const [workspaceMembersError, setWorkspaceMembersError] = useState<string>();
  // 폴더 멤버 초대·제외는 워크스페이스 소유자만, 다른 멤버는 목록 조회만 (2026-10-26 결정)
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = () => setDialog(null);
  const notice = (text: string) => setToast({ text, variant: 'info' });
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [info, rows, folderMembers, pending] = await Promise.all([
        getFolder(id),
        listFolderMeetingRows(id),
        listFolderMemberDetails(id),
        listFolderPendingAgendas(id),
      ]);
      const workspace = await getWorkspace(info.workspaceId);
      if (!isCurrent) {
        return;
      }
      setIsWorkspaceOwner(workspace.isOwner);
      setFolder(info);
      setMeetings(rows);
      setMembers(folderMembers);
      setPendingAgendas(pending);
    };
    load().catch((error: unknown) => {
      if (isCurrent) {
        showError(error);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [id, showError]);

  const openMembers = async () => {
    setDialog({ type: 'members' });
    if (!folder || !isWorkspaceOwner || workspaceMembers) {
      return;
    }
    // REQ-041 폴더에는 워크스페이스 멤버만 초대한다
    try {
      setWorkspaceMembers(await listWorkspaceMembers(folder.workspaceId));
    } catch (error) {
      setWorkspaceMembersError(errorMessage(error));
    }
  };

  const reloadMembers = async () => setMembers(await listFolderMemberDetails(id));

  const addMembers = async (userIds: number[]) => {
    try {
      for (const userId of userIds) {
        await addFolderMember(id, userId);
      }
    } finally {
      await reloadMembers();
    }
  };

  const removeMembers = async (userIds: number[]) => {
    try {
      for (const userId of userIds) {
        await removeFolderMember(id, userId);
      }
    } finally {
      await reloadMembers();
    }
  };

  const leave = async () => {
    closeDialog();
    try {
      await leaveFolder(id);
      navigate(`/workspaces/${folder?.workspaceId}`, { replace: true });
    } catch (error) {
      showError(error);
    }
  };

  if (!folder) {
    return <AppLayout className={styles.page}>{toast && <Toast message={toast} onClose={closeToast} />}</AppLayout>;
  }

  return (
    <AppLayout className={styles.page} workspaceId={folder.workspaceId}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <nav className={styles.breadcrumb} aria-label="현재 위치">
            <button type="button" className={styles.crumb} onClick={() => navigate(`/workspaces/${folder.workspaceId}`)}>
              워크스페이스
            </button>
            <Placeholder size={SMALL_ICON_SIZE} />
            <span aria-current="page">{folder.name}</span>
          </nav>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{folder.name}</h1>
            <FavoriteButton
              target={{ type: 'folder', workspaceId: folder.workspaceId, folderId: folder.folderId }}
              name={folder.name}
              onError={(text) => setToast({ text, variant: 'error' })}
            />
          </div>
        </div>
        <div className={styles.actions}>
          {/* REQ-050 폴더 멤버 모두 새 회의를 만들 수 있다 */}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(`/folders/${folder.folderId}/meetings/new`)}
          >
            <Placeholder size={SMALL_ICON_SIZE} />새 회의
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="meetings-title">
            <div className={styles.sectionHead}>
              <h2 id="meetings-title" className={styles.sectionTitle}>
                회의 목록
              </h2>
              {/* REQ-053 회의 목록 오른쪽 위 [회의록 아카이브] */}
              <button
                type="button"
                className={styles.archive}
                onClick={() => navigate(`/workspaces/${folder.workspaceId}/archive`)}
              >
                회의록 아카이브
                <Placeholder size={SMALL_ICON_SIZE} />
              </button>
            </div>
            <MeetingTable meetings={meetings} onOpen={(meeting) => navigate(meetingPath(meeting))} />
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.section} aria-labelledby="folder-members-title">
            <h2 id="folder-members-title" className={styles.sectionTitle}>
              멤버
            </h2>
            <div className={styles.memberCard}>
              <AvatarStack members={members} label={`폴더 멤버 ${members.length}명`} />
              <button type="button" className={styles.memberManage} onClick={openMembers}>
                멤버관리
                <Placeholder size={TITLE_ICON_SIZE} />
              </button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="pending-title">
            <div className={styles.pendingHead}>
              <div>
                <h2 id="pending-title" className={styles.sectionTitle}>
                  남은 안건
                </h2>
                <p className={styles.pendingCaption}>이전 회의에서 결정하지 못한 안건이에요.</p>
              </div>
              <span className={styles.pendingCount}>{pendingAgendas.length}</span>
            </div>
            <div className={styles.pendingCard}>
              {pendingAgendas.length === 0 ? (
                // MSG-035
                <p className={styles.pendingEmpty}>이전 회의에서 넘어온 안건이 없습니다.</p>
              ) : (
                <ul className={styles.pendingList}>
                  {pendingAgendas.map((agenda, index) => (
                    <Fragment key={agenda.pendingAgendaId}>
                      {index > 0 && (
                        <li aria-hidden="true">
                          <img
                            src={dividerPending}
                            alt=""
                            width={PENDING_DIVIDER_WIDTH}
                            height={1}
                            className={styles.divider}
                          />
                        </li>
                      )}
                      <li className={styles.pendingItem}>
                        <span className={styles.pendingTitle}>{agenda.title}</span>
                        <span className={styles.pendingMeta}>
                          {agenda.fromMeetingTitle}
                          <span className={styles.metaDivider} aria-hidden="true">
                            <img src={dividerPendingMeta} alt="" width={PENDING_META_DIVIDER_LENGTH} height={1} />
                          </span>
                          {agenda.carriedAt.replaceAll('-', '.')}
                        </span>
                      </li>
                    </Fragment>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* REQ-139 기본 폴더에서는 나갈 수 없다 */}
          {!folder.isDefault && (
            <button type="button" className={styles.leave} onClick={() => setDialog({ type: 'leave' })}>
              이 폴더 나가기
              <Placeholder size={SMALL_ICON_SIZE} />
            </button>
          )}
        </aside>
      </div>

      {dialog?.type === 'members' && (
        <FolderMembersModal
          members={members}
          workspaceMembers={workspaceMembers}
          workspaceMembersError={workspaceMembersError}
          canManage={isWorkspaceOwner}
          onAdd={addMembers}
          onRemove={removeMembers}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'leave' &&
        (folder.isOwner ? (
          // MSG-045
          <ConfirmDialog
            title="소유권을 양도해야 폴더에서 나갈 수 있습니다."
            message="다른 폴더 멤버에게 소유권을 양도한 후 다시 시도해 주세요."
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={openMembers}
          />
        ) : (
          // MSG-044
          <ConfirmDialog
            title="프로젝트 폴더에서 나가시겠습니까?"
            message="나가면 이 폴더의 회의와 회의록을 더 이상 볼 수 없습니다."
            cancelLabel="취소"
            confirmLabel="나가기"
            onCancel={closeDialog}
            onConfirm={leave}
          />
        ))}
    </AppLayout>
  );
}
