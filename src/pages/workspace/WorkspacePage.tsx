import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { listFolderMeetingRows } from '../../api/meeting';
import { getMe } from '../../api/user';
import {
  changeFolderAccess,
  createFolder,
  deleteFolder,
  deleteWorkspace,
  getWorkspace,
  inviteByEmail,
  issueInviteLink,
  leaveWorkspace,
  listFolderMembers,
  listFolders,
  listMyWorkspaces,
  listWorkspaceMembers,
  markLastVisited,
  removeWorkspaceMember,
  renameFolder,
  transferWorkspaceOwnership,
  updateWorkspace,
  WORKSPACE_ERROR_CODES,
  type WorkspaceDetail,
} from '../../api/workspace';
import addIcon from '../../assets/icons/add-sm.svg';
import arrowDownIcon from '../../assets/icons/arrow-down.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import settingsIcon from '../../assets/icons/settings.svg';
import AppLayout from '../../components/AppLayout';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Member } from '../../types/meeting';
import type { FolderAccess, FolderMeeting, FolderSummary, WorkspaceMember, WorkspaceSummary } from '../../types/workspace';
import deleteIcon from '../../assets/icons/delete.svg';
import editIcon from '../../assets/icons/edit.svg';
import ActionMenu from './ActionMenu';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import DefaultTemplateCard from './DefaultTemplateCard';
import FolderNameModal from './FolderNameModal';
import OnboardingBar from './OnboardingBar';
import WeekMeetings from './WeekMeetings';
import WorkspaceFolderCard, { type FolderActivity } from './WorkspaceFolderCard';
import WorkspaceMembersModal from './WorkspaceMembersModal';
import WorkspaceSettingsModal from './WorkspaceSettingsModal';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import styles from './WorkspacePage.module.css';

const ICON_SIZE = 20;
const ARROW_ICON_SIZE = 24;
// MSG-061
const INVITED_MESSAGE = '초대 메일을 1명에게 보냈어요.';
// MSG-031 (서버 FOLDER_NAME_DUPLICATED)
const DUPLICATE_FOLDER_MESSAGE = '같은 이름의 폴더가 이미 있어요. 다른 이름을 입력해 주세요.';

type Dialog =
  | { type: 'newFolder' }
  | { type: 'rename'; folder: FolderSummary }
  | { type: 'deleteFolder'; folder: FolderSummary }
  | { type: 'members' }
  | { type: 'leave' }
  | { type: 'deleteWorkspace' }
  | { type: 'createWorkspace' }
  | { type: 'settings' };

/** 폴더 이름 중복은 창 안에서 안내한다 (MSG-031) */
function folderNameError(error: unknown) {
  return isApiError(error, WORKSPACE_ERROR_CODES.folderNameDuplicated) ? DUPLICATE_FOLDER_MESSAGE : errorMessage(error);
}

/** 다음 예정 회의(가장 가까운 것), 없으면 마지막 회의 날짜 */
function activityOf(rows: FolderMeeting[]): FolderActivity {
  const now = new Date().toISOString().slice(0, 16);
  const upcoming = rows
    .filter(({ status, startAt }) => status === 'scheduled' && (startAt ?? '') >= now)
    .map(({ startAt }) => startAt ?? '')
    .sort();
  if (upcoming.length > 0) {
    return { next: upcoming[0] };
  }
  const past = rows.filter(({ status }) => status !== 'scheduled').map(({ date }) => date).sort();
  return past.length > 0 ? { last: past[past.length - 1] } : {};
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
  // 피그마 Page 8 폴더 카드의 다음(마지막) 회의와 폴더 멤버
  const [activities, setActivities] = useState<Record<number, FolderActivity>>({});
  const [folderMembers, setFolderMembers] = useState<Record<number, Member[]>>({});
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreAnchorRef = useRef<HTMLButtonElement>(null);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const location = useLocation();
  // MSG-101 폴더 화면의 [소유권 양도]로 오면 멤버 관리 창(소유권 넘기기)을 바로 연다
  const [dialog, setDialog] = useState<Dialog | null>(() =>
    (location.state as { openMembers?: boolean } | null)?.openMembers ? { type: 'members' } : null,
  );
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [menuFolderId, setMenuFolderId] = useState<number | null>(null);
  // 새 워크스페이스 만들기에서 초대 메일을 보내고 넘어오면 결과를 토스트로 보여 준다 (MSG-061)
  const arrivedNotice = (location.state as { notice?: string } | null)?.notice;
  const [toast, setToast] = useState<ToastMessage | null>(arrivedNotice ? { text: arrivedNotice, variant: 'success' } : null);
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
      const [detail, mine, folderList, me] = await Promise.all([
        getWorkspace(id),
        listMyWorkspaces(),
        listFolders(id),
        getMe().catch(() => null),
      ]);
      // REQ-037 폴더 카드의 회의 수, 다음(마지막) 회의는 meeting-service 폴더 회의 목록으로, 얼굴은 폴더 멤버로
      const [rows, memberLists] = await Promise.all([
        Promise.all(folderList.map(({ folderId }) => listFolderMeetingRows(folderId).catch(() => []))),
        Promise.all(folderList.map(({ folderId }) => listFolderMembers(folderId).catch(() => []))),
      ]);
      // TODO(백엔드): 멤버도 목록을 볼 수 있게 바뀌기 전까지는 소유자가 아니면 403이라 빈 목록으로 둔다
      const memberList = await listWorkspaceMembers(id).catch(() => []);
      if (!isCurrent) {
        return;
      }
      setWorkspace(detail);
      setMyUserId(me?.userId ?? null);
      setWorkspaces(mine);
      setFolders(folderList.map((folder, index) => ({ ...folder, meetingCount: rows[index].length })));
      setActivities(Object.fromEntries(folderList.map((folder, index) => [folder.folderId, activityOf(rows[index])])));
      setFolderMembers(Object.fromEntries(folderList.map((folder, index) => [folder.folderId, memberLists[index]])));
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

  // REQ-178 불러오는 동안 회색 자리
  if (!workspace) {
    return (
      <AppLayout className={styles.page}>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <Skeleton width={280} height={32} />
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </AppLayout>
    );
  }

  const addFolder = async (name: string) => {
    const created = await createFolder(id, name);
    setFolders((prev) => [...prev, { folderId: created.folderId, name: created.name, isDefault: false, meetingCount: 0, ownerUserId: myUserId }]);
    closeDialog();
    // MSG-093
    setToast({ text: `'${created.name}' 폴더를 만들었어요.`, variant: 'success' });
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
      notice(`${members.find((member) => member.userId === userId)?.name ?? '멤버'} 님의 권한을 바꿨어요.`); // MSG-095
      // REQ-198 워크스페이스 시작하기의 폴더 권한 정하기를 마친다
      setWorkspace((prev) => prev && { ...prev, folderAccessConfigured: true });
    } catch (error) {
      showError(error);
    }
  };

  const removeMember = async (userId: number) => {
    try {
      await removeWorkspaceMember(id, userId);
      setMembers((prev) => prev.filter((member) => member.userId !== userId));
      setWorkspace((prev) => prev && { ...prev, memberCount: prev.memberCount - 1 });
      notice(`${members.find((member) => member.userId === userId)?.name ?? '멤버'} 님을 워크스페이스에서 내보냈어요.`); // MSG-098
    } catch (error) {
      showError(error);
    }
  };

  /** REQ-129 넘기면 나는 일반 멤버가 되어 관리 버튼이 사라진다 */
  const transferOwnership = async (userId: number) => {
    await transferWorkspaceOwnership(id, userId);
    setMembers((prev) => prev.map((member) => ({ ...member, isOwner: member.userId === userId })));
    setWorkspace((prev) => prev && { ...prev, isOwner: false });
    closeDialog();
    const newOwner = members.find((member) => member.userId === userId);
    notice(`${newOwner?.name ?? '선택한 멤버'} 님에게 소유권을 넘겼어요.`); // MSG-092
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
                <Icon src={arrowDownIcon} size={ARROW_ICON_SIZE} />
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
                    setDialog({ type: 'createWorkspace' });
                  }}
                  onSettings={() => {
                    closeSwitcher();
                    setDialog({ type: 'settings' });
                  }}
                  onClose={closeSwitcher}
                />
              )}
            </span>
            {/* REQ-151 즐겨찾기는 폴더만. 워크스페이스 별은 뺐다 (디자인 체크 2026-11-19) */}
          </div>
          {workspace.description && <p className={styles.workspaceDescription}>{workspace.description}</p>}
        </div>
        <div className={styles.pageActions}>
          <button type="button" className={styles.newFolder} onClick={() => setDialog({ type: 'newFolder' })}>
            <Icon src={addIcon} size={ICON_SIZE} />새 폴더
          </button>
          {/* 피그마 Page 8 MoreButton: 워크스페이스 설정, 내 프로필, 나가기 */}
          <span className={styles.anchor}>
            <button
              ref={moreAnchorRef}
              type="button"
              className={styles.iconButton}
              aria-label="워크스페이스 더보기"
              aria-haspopup="menu"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((value) => !value)}
            >
              <Icon src={moreIcon} size={ARROW_ICON_SIZE} />
            </button>
            {isMoreOpen && (
              <ActionMenu
                label="워크스페이스 메뉴"
                anchorRef={moreAnchorRef}
                onClose={() => setIsMoreOpen(false)}
                items={[
                  { label: '워크스페이스 설정', icon: settingsIcon, onSelect: () => setDialog({ type: 'settings' }) },
                  { label: '워크스페이스 나가기', icon: logoutIcon, onSelect: () => setDialog({ type: 'leave' }) },
                ].map((item) => ({
                  ...item,
                  onSelect: () => {
                    setIsMoreOpen(false);
                    item.onSelect();
                  },
                }))}
              />
            )}
          </span>
        </div>
      </div>

      {/* 피그마 Page 8 SummaryBar: 멤버 수, 내 권한, 회의록 기본 양식(REQ-199) */}
      <div className={styles.summaryBar}>
        <button type="button" className={styles.linkButton} onClick={() => setDialog({ type: 'members' })}>
          멤버 {workspace.memberCount}명
        </button>
        <span className={styles.summaryDivider} aria-hidden="true" />
        <span className={styles.summaryLabel}>내 권한</span>
        <span className={styles.roleBadge}>{isOwner ? '소유자' : '멤버'}</span>
        <span className={styles.summaryDivider} aria-hidden="true" />
        <DefaultTemplateCard
          workspaceId={id}
          templateId={workspace.defaultTemplateId}
          isOwner={isOwner}
          onChanged={(templateId) => {
            setWorkspace((prev) => prev && { ...prev, defaultTemplateId: templateId });
            setToast({ text: '회의록 기본 양식을 바꿨어요.', variant: 'success' });
          }}
          onError={showError}
        />
      </div>

      <WeekMeetings workspaceId={id} folders={folders} />

      {isOwner && (
        <OnboardingBar
          workspaceId={id}
          steps={[
            { label: '멤버 초대하기', done: workspace.memberCount > 1, actionLabel: '멤버 초대', onAction: () => setDialog({ type: 'members' }) },
            {
              label: '회의록 기본 양식 정하기',
              done: workspace.defaultTemplateId !== null,
              actionLabel: '양식 정하기',
              onAction: () => document.getElementById('default-template-change')?.click(),
            },
            {
              // 멤버 권한 관리에서 멤버의 폴더 접근 권한(모든 폴더 / 초대된 폴더만)을 한 번이라도 정하면 끝 (2026-11-17 결정)
              label: '폴더 권한 정하기',
              done: workspace.folderAccessConfigured,
              actionLabel: '권한 설정',
              onAction: () => setDialog({ type: 'members' }),
            },
          ]}
        />
      )}

      {/* 피그마 Page 8 FolderPanel: 프로젝트 색 폴더 카드 (REQ-037, 202) */}
      <section className={styles.folders} aria-labelledby="folders-title">
        <div className={styles.sectionHead}>
          <h2 id="folders-title" className={styles.sectionTitle}>
            프로젝트 폴더
          </h2>
          <span className={styles.count}>총 {folders.length}개</span>
        </div>
        <ul className={styles.folderGrid}>
          {folders.map((folder) => (
            <WorkspaceFolderCard
              key={folder.folderId}
              folder={folder}
              workspaceId={id}
              activity={activities[folder.folderId]}
              members={folderMembers[folder.folderId] ?? []}
              onError={(text) => setToast({ text, variant: 'error' })}
              menu={
                <FolderMenu
                  folder={folder}
                  // REQ-165 (2026-11-17 시트): 이름 바꾸기는 프로젝트 소유자(기본 폴더는 워크스페이스 소유자), 삭제는 프로젝트 소유자와 워크스페이스 소유자
                  canRename={folder.isDefault ? isOwner : myUserId !== null && folder.ownerUserId === myUserId}
                  canDelete={!folder.isDefault && (isOwner || (myUserId !== null && folder.ownerUserId === myUserId))}
                  isOpen={menuFolderId === folder.folderId}
                  onToggle={() => setMenuFolderId((current) => (current === folder.folderId ? null : folder.folderId))}
                  onClose={closeFolderMenu}
                  onRename={() => setDialog({ type: 'rename', folder })}
                  onDelete={() => setDialog({ type: 'deleteFolder', folder })}
                />
              }
            />
          ))}
        </ul>
      </section>

      {dialog?.type === 'createWorkspace' && <CreateWorkspaceModal onClose={closeDialog} />}
      {dialog?.type === 'settings' && (
        <WorkspaceSettingsModal
          name={workspace.name}
          description={workspace.description}
          isOwner={isOwner}
          onSave={async (name, description) => {
            const saved = await updateWorkspace(id, name, description);
            setWorkspace((prev) => prev && { ...prev, ...saved });
            setWorkspaces((prev) => prev.map((item) => (item.workspaceId === id ? { ...item, name: saved.name } : item)));
            closeDialog();
            setToast({ text: '워크스페이스 설정을 저장했어요', variant: 'success' });
          }}
          onLeave={() => setDialog({ type: 'leave' })}
          onDelete={() => setDialog({ type: 'deleteWorkspace' })}
          onClose={closeDialog}
        />
      )}
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
          title="폴더를 삭제할까요?"
          message={'폴더 안의 회의와 회의록도 함께 쓰레기통으로 이동하며\n3개월 안에 복구할 수 있어요.'}
          cancelLabel="취소"
          confirmLabel="삭제하기"
          isDanger
          onCancel={closeDialog}
          onConfirm={() => removeFolder(dialog.folder.folderId)}
        />
      )}
      {dialog?.type === 'members' && (
        <WorkspaceMembersModal
          workspaceId={id}
          members={members}
          canManage={isOwner}
          myUserId={myUserId}
          onInvite={invite}
          onCopyInviteLink={copyInviteLink}
          onAccessChange={updateAccess}
          onRemove={removeMember}
          onTransfer={transferOwnership}
          onNotice={notice}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'leave' &&
        (isOwner ? (
          // MSG-042 소유자는 소유권을 넘긴 뒤에 나갈 수 있다
          <ConfirmDialog
            title="소유권을 양도해야 워크스페이스에서 나갈 수 있어요."
            message="다른 멤버에게 소유권을 양도한 후 다시 시도해 주세요."
            cancelLabel="취소"
            confirmLabel="소유권 양도"
            onCancel={closeDialog}
            onConfirm={() => setDialog({ type: 'members' })}
          />
        ) : (
          // MSG-041
          <ConfirmDialog
            title={`${workspace.name}에서 나갈까요?`}
            // 디자인 LeaveConfirmModal 문구 (강제 줄바꿈 없이)
            message="나가면 이 워크스페이스의 폴더와 회의록을 볼 수 없어요. 다시 들어오려면 초대를 받아야 해요."
            cancelLabel="취소"
            confirmLabel="나가기"
            onCancel={closeDialog}
            onConfirm={leave}
          />
        ))}
      {dialog?.type === 'deleteWorkspace' && (
        // MSG-043
        <ConfirmDialog
          title="워크스페이스를 삭제할까요?"
          message={'워크스페이스 안의 모든 폴더, 회의, 회의록이 함께 삭제되고\n되돌릴 수 없어요.'}
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
  canRename: boolean;
  /** 기본 폴더는 지울 수 없다 (REQ-044) */
  canDelete: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * REQ-165 폴더 카드 오른쪽 위 더보기: 이름 바꾸기, 폴더 삭제. 즐겨찾기는 카드의 별로 한다 (2026-11-17).
 * 할 수 있는 것이 없으면 더보기를 숨긴다
 */
function FolderMenu({ folder, canRename, canDelete, isOpen, onToggle, onClose, onRename, onDelete }: FolderMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const items = [
    ...(canRename ? [{ label: '이름 바꾸기', icon: editIcon, onSelect: onRename, isDanger: false }] : []),
    ...(canDelete ? [{ label: '폴더 삭제', icon: deleteIcon, onSelect: onDelete, isDanger: true }] : []),
  ];
  if (items.length === 0) {
    return null;
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
        <Icon src={moreIcon} size={ICON_SIZE} />
      </button>
      {isOpen && <ActionMenu label={`${folder.name} 메뉴`} items={items} anchorRef={anchorRef} onClose={onClose} />}
    </span>
  );
}
