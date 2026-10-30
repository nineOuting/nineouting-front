import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { countFolderMeetings } from '../../api/meeting';
import {
  changeFolderAccess,
  createFolder,
  deleteFolder,
  deleteWorkspace,
  getWorkspace,
  inviteByEmail,
  issueInviteLink,
  leaveWorkspace,
  listFolders,
  listMyWorkspaces,
  listWorkspaceMembers,
  markLastVisited,
  removeWorkspaceMember,
  renameFolder,
  WORKSPACE_ERROR_CODES,
  type WorkspaceDetail,
} from '../../api/workspace';
import dividerWsMember from '../../assets/divider-ws-member.svg';
import AppLayout from '../../components/AppLayout';
import AvatarStack from '../../components/AvatarStack';
import ConfirmDialog from '../../components/ConfirmDialog';
import FavoriteButton from '../../components/FavoriteButton';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { FolderAccess, FolderSummary, WorkspaceMember, WorkspaceSummary } from '../../types/workspace';
import ActionMenu from './ActionMenu';
import FolderNameModal from './FolderNameModal';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import WorkspaceProfileModal from './WorkspaceProfileModal';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import styles from './WorkspacePage.module.css';

const SMALL_ICON_SIZE = 16;
const TITLE_ICON_SIZE = 20;
const FOLDER_ICON_SIZE = 24;
const DELETE_ICON_SIZE = 27;
const MEMBER_DIVIDER_WIDTH = 224;
const CREATE_WORKSPACE_PENDING_MESSAGE = '새 워크스페이스 만들기 화면은 디자인이 나오면 연결돼요.';
const INVITED_MESSAGE = '초대 메일을 보냈어요. 받은 사람이 메일의 링크로 수락하면 멤버가 돼요.';
// MSG-031 (서버 FOLDER_NAME_DUPLICATED)
const DUPLICATE_FOLDER_MESSAGE = '같은 이름의 폴더가 이미 있습니다. 다른 이름을 입력해 주세요.';

type Dialog =
  | { type: 'newFolder' }
  | { type: 'rename'; folder: FolderSummary }
  | { type: 'deleteFolder'; folder: FolderSummary }
  | { type: 'members' }
  | { type: 'profile' }
  | { type: 'leave' }
  | { type: 'deleteWorkspace' };

/** 폴더 이름 중복은 창 안에서 안내한다 (MSG-031) */
function folderNameError(error: unknown) {
  return isApiError(error, WORKSPACE_ERROR_CODES.folderNameDuplicated) ? DUPLICATE_FOLDER_MESSAGE : errorMessage(error);
}

/** REQ-028~040, 127~129, 138 워크스페이스 화면 (프로젝트 폴더 목록·멤버) */
export default function WorkspacePage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const id = Number(workspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  // 멤버는 목록을 보기만 하고, 초대·제외·권한 변경은 워크스페이스 소유자만 한다 (2026-10-26 결정)
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [menuFolderId, setMenuFolderId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeDialog = () => setDialog(null);
  const closeSwitcher = useCallback(() => setIsSwitcherOpen(false), []);
  const closeFolderMenu = useCallback(() => setMenuFolderId(null), []);
  const switcherAnchorRef = useRef<HTMLButtonElement>(null);
  const isOwner = Boolean(workspace?.isOwner);
  const notice = (text: string) => setToast({ text, variant: 'info' });
  const showError = useCallback((error: unknown) => setToast({ text: errorMessage(error), variant: 'error' }), []);

  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const [detail, mine, folderList] = await Promise.all([getWorkspace(id), listMyWorkspaces(), listFolders(id)]);
      // REQ-037 폴더 카드의 회의 수는 meeting-service 회의 목록의 전체 개수로 센다
      const counts = await Promise.all(folderList.map(({ folderId }) => countFolderMeetings(folderId).catch(() => 0)));
      // TODO(백엔드): 멤버도 목록을 볼 수 있게 바뀌기 전까지는 소유자가 아니면 403이라 빈 목록으로 둔다
      const memberList = await listWorkspaceMembers(id).catch(() => []);
      if (!isCurrent) {
        return;
      }
      setWorkspace(detail);
      setWorkspaces(mine);
      setFolders(folderList.map((folder, index) => ({ ...folder, meetingCount: counts[index] })));
      setMembers(memberList);
      // REQ-030 마지막으로 들어온 워크스페이스로 기억한다
      markLastVisited(id).catch(() => undefined);
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

  if (!workspace) {
    return <AppLayout className={styles.page}>{toast && <Toast message={toast} onClose={closeToast} />}</AppLayout>;
  }

  const addFolder = async (name: string) => {
    const created = await createFolder(id, name);
    setFolders((prev) => [...prev, { folderId: created.folderId, name: created.name, isDefault: false, meetingCount: 0 }]);
    closeDialog();
  };

  const rename = async (folderId: number, name: string) => {
    await renameFolder(folderId, name);
    setFolders((prev) => prev.map((folder) => (folder.folderId === folderId ? { ...folder, name } : folder)));
    closeDialog();
  };

  const removeFolder = async (folderId: number) => {
    closeDialog();
    try {
      await deleteFolder(folderId);
      setFolders((prev) => prev.filter((folder) => folder.folderId !== folderId));
    } catch (error) {
      showError(error);
    }
  };

  const invite = async (email: string) => {
    await inviteByEmail(id, email);
    notice(INVITED_MESSAGE);
  };

  // REQ-034 발급할 때마다 이전 링크는 무효가 된다
  const copyInviteLink = async () => {
    try {
      const url = await issueInviteLink(id);
      try {
        await navigator.clipboard.writeText(url);
        notice('초대 링크를 복사했어요. 1일 동안 쓸 수 있고, 이전 링크는 더 이상 쓸 수 없어요.');
      } catch {
        notice(`초대 링크: ${url}`);
      }
    } catch (error) {
      showError(error);
    }
  };

  const updateAccess = async (userId: number, folderAccess: FolderAccess) => {
    try {
      await changeFolderAccess(id, userId, folderAccess);
      setMembers((prev) => prev.map((member) => (member.userId === userId ? { ...member, folderAccess } : member)));
    } catch (error) {
      showError(error);
    }
  };

  const removeMember = async (userId: number) => {
    try {
      await removeWorkspaceMember(id, userId);
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
      setWorkspace((prev) => prev && { ...prev, memberCount: prev.memberCount - 1 });
    } catch (error) {
      showError(error);
    }
  };

  const leave = async () => {
    closeDialog();
    try {
      await leaveWorkspace(id);
      navigate('/home', { replace: true });
    } catch (error) {
      showError(error);
    }
  };

  const removeWorkspace = async () => {
    closeDialog();
    try {
      await deleteWorkspace(id);
      navigate('/home', { replace: true });
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AppLayout
      className={styles.page}
      workspaceId={id}
      sidebarFooter={
        // REQ-138 워크스페이스 소유자만 삭제할 수 있다
        isOwner && (
          <button type="button" className={styles.deleteWorkspace} onClick={() => setDialog({ type: 'deleteWorkspace' })}>
            이 워크스페이스 삭제
            <Placeholder size={DELETE_ICON_SIZE} />
          </button>
        )
      }
    >
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.breadcrumb}>워크스페이스</p>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{workspace.name}</h1>
            <span className={styles.anchor}>
              <button
                ref={switcherAnchorRef}
                type="button"
                className={styles.iconButton}
                aria-label="워크스페이스 전환"
                aria-expanded={isSwitcherOpen}
                onClick={() => setIsSwitcherOpen((value) => !value)}
              >
                <Placeholder size={TITLE_ICON_SIZE} />
              </button>
              {isSwitcherOpen && (
                <WorkspaceSwitcher
                  workspaces={workspaces}
                  currentId={workspace.workspaceId}
                  anchorRef={switcherAnchorRef}
                  onSelect={(selectedId) => {
                    closeSwitcher();
                    navigate(`/workspaces/${selectedId}`);
                  }}
                  onCreate={() => {
                    closeSwitcher();
                    notice(CREATE_WORKSPACE_PENDING_MESSAGE);
                  }}
                  onClose={closeSwitcher}
                />
              )}
            </span>
            <FavoriteButton
              target={{ type: 'workspace', workspaceId: workspace.workspaceId }}
              name={workspace.name}
              onError={(text) => setToast({ text, variant: 'error' })}
            />
          </div>
        </div>
        <button type="button" className={styles.newFolder} onClick={() => setDialog({ type: 'newFolder' })}>
          <Placeholder size={SMALL_ICON_SIZE} />새 폴더
        </button>
      </div>

      <div className={styles.columns}>
        <section className={styles.folders} aria-labelledby="folders-title">
          <div className={styles.sectionHead}>
            <h2 id="folders-title" className={styles.sectionTitle}>
              프로젝트 폴더
            </h2>
            <span className={styles.count}>총 {folders.length}개</span>
          </div>
          <ul className={styles.folderGrid}>
            {folders.map((folder) => (
              <li key={folder.folderId} className={styles.folderCard}>
                {/* 카드 전체를 누르면 폴더로 이동한다 (REQ-038) */}
                <button
                  type="button"
                  className={styles.folderLink}
                  onClick={() => navigate(`/folders/${folder.folderId}`)}
                >
                  <Placeholder size={FOLDER_ICON_SIZE} />
                  <span className={styles.folderTexts}>
                    <span className={styles.folderName}>{folder.name}</span>
                    <span className={styles.folderMeta}>회의 {folder.meetingCount}개</span>
                  </span>
                </button>
                <FolderMenu
                  folder={folder}
                  isOpen={menuFolderId === folder.folderId}
                  onToggle={() => setMenuFolderId((current) => (current === folder.folderId ? null : folder.folderId))}
                  onClose={closeFolderMenu}
                  onRename={() => setDialog({ type: 'rename', folder })}
                  onDelete={() => setDialog({ type: 'deleteFolder', folder })}
                />
              </li>
            ))}
          </ul>
          <p className={styles.hint}>폴더를 선택하면 해당 프로젝트 폴더로 이동할 수 있어요.</p>
        </section>

        <aside className={styles.side}>
          <section className={styles.memberSection} aria-labelledby="members-title">
            <h2 id="members-title" className={styles.sectionTitle}>
              멤버
            </h2>
            <div className={styles.memberCard}>
              <div className={styles.memberSummary}>
                <div className={styles.memberHead}>
                  <span className={styles.memberLabel}>워크스페이스 멤버</span>
                  <span className={styles.memberCount}>총 {workspace.memberCount}명</span>
                </div>
                {members.length > 0 && (
                  <AvatarStack
                    members={members}
                    layout="spaced"
                    label={`워크스페이스 멤버 ${workspace.memberCount}명`}
                  />
                )}
              </div>
              <img src={dividerWsMember} alt="" width={MEMBER_DIVIDER_WIDTH} height={1} className={styles.divider} />
              {/* 멤버는 목록만 보고, 관리는 소유자만 (REQ-033) */}
              <button type="button" className={styles.rowButton} onClick={() => setDialog({ type: 'members' })}>
                {isOwner ? '멤버 권한 및 관리' : '멤버 목록'}
                <Placeholder size={SMALL_ICON_SIZE} />
              </button>
            </div>
          </section>
          {/* REQ-114·115·118 디자인이 없어 나가기 버튼과 같은 모양으로 넣었다 */}
          <button type="button" className={styles.rowButton} onClick={() => setDialog({ type: 'profile' })}>
            이 워크스페이스에서 내 프로필
            <Placeholder size={SMALL_ICON_SIZE} />
          </button>
          <button
            type="button"
            className={`${styles.rowButton} ${styles.leave}`}
            onClick={() => setDialog({ type: 'leave' })}
          >
            이 워크스페이스 나가기
            <Placeholder size={SMALL_ICON_SIZE} />
          </button>
        </aside>
      </div>

      {dialog?.type === 'newFolder' && (
        <FolderNameModal
          title="새 프로젝트 폴더"
          description="관리할 프로젝트 폴더를 만들어 주세요."
          submitLabel="폴더 만들기"
          siblingNames={folders.map(({ name }) => name)}
          toErrorMessage={folderNameError}
          onSubmit={addFolder}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'rename' && (
        <FolderNameModal
          title="폴더 이름 바꾸기"
          description="바꿀 폴더명을 입력해 주세요."
          submitLabel="이름 바꾸기"
          initialName={dialog.folder.name}
          siblingNames={folders.filter(({ folderId }) => folderId !== dialog.folder.folderId).map(({ name }) => name)}
          toErrorMessage={folderNameError}
          onSubmit={(name) => rename(dialog.folder.folderId, name)}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'deleteFolder' && (
        // MSG-046
        <ConfirmDialog
          title="폴더를 삭제하시겠습니까?"
          message={'폴더 안의 회의와 회의록도 함께 쓰레기통으로 이동하며\n3개월 안에 복구할 수 있습니다.'}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={closeDialog}
          onConfirm={() => removeFolder(dialog.folder.folderId)}
        />
      )}
      {dialog?.type === 'members' && (
        <WorkspaceMembersModal
          members={members}
          canManage={isOwner}
          onInvite={invite}
          onCopyInviteLink={copyInviteLink}
          onAccessChange={updateAccess}
          onRemove={removeMember}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'profile' && (
        <WorkspaceProfileModal
          workspaceId={id}
          onSaved={(text) => {
            closeDialog();
            notice(text);
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'leave' &&
        (isOwner ? (
          // MSG-042 소유자는 소유권을 넘긴 뒤에 나갈 수 있다
          <ConfirmDialog
            title="소유권을 양도해야 워크스페이스에서 나갈 수 있습니다."
            message="다른 멤버에게 소유권을 양도한 후 다시 시도해 주세요."
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => setDialog({ type: 'members' })}
          />
        ) : (
          // MSG-041
          <ConfirmDialog
            title="워크스페이스에서 나가시겠습니까?"
            message={'나가면 이 워크스페이스의 폴더와 회의록을 더 이상 볼 수 없습니다.\n다시 참여하려면 초대를 받아야 합니다.'}
            cancelLabel="취소"
            confirmLabel="나가기"
            onCancel={closeDialog}
            onConfirm={leave}
          />
        ))}
      {dialog?.type === 'deleteWorkspace' && (
        // MSG-043
        <ConfirmDialog
          title="워크스페이스를 삭제하시겠습니까?"
          message={'워크스페이스 안의 모든 폴더, 회의, 회의록이 함께 삭제되며\n되돌릴 수 없습니다.'}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={closeDialog}
          onConfirm={removeWorkspace}
        />
      )}
    </AppLayout>
  );
}

interface FolderMenuProps {
  folder: FolderSummary;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/** 폴더 카드 오른쪽 위 더보기. 기본 폴더는 지울 수 없다 (REQ-044) */
function FolderMenu({ folder, isOpen, onToggle, onClose, onRename, onDelete }: FolderMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const items = [{ label: '이름 바꾸기', onSelect: onRename }];
  if (!folder.isDefault) {
    items.push({ label: '폴더 삭제', onSelect: onDelete });
  }

  return (
    <span className={styles.anchor}>
      <button
        ref={anchorRef}
        type="button"
        className={styles.iconButton}
        aria-label={`${folder.name} 더보기`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <Placeholder size={SMALL_ICON_SIZE} />
      </button>
      {isOpen && <ActionMenu label={`${folder.name} 메뉴`} items={items} anchorRef={anchorRef} onClose={onClose} />}
    </span>
  );
}
