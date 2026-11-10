import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { errorMessage, isApiError } from '../../api/client';
import { listFolderMeetingRows, listFolderPendingAgendas, restoreMeeting, trashMeeting } from '../../api/meeting';
import {
  addFolderMember,
  deleteFolder,
  renameFolder,
  setFavorite,
  WORKSPACE_ERROR_CODES,
  getFolder,
  getWorkspace,
  leaveFolder,
  listFolderMemberDetails,
  listWorkspaceMembers,
  removeFolderMember,
  type FolderInfo,
} from '../../api/workspace';
import addIcon from '../../assets/icons/add-sm.svg';
import separatorIcon from '../../assets/icons/breadcrumb-sep.svg';
import AppLayout from '../../components/AppLayout';
import AvatarStack from '../../components/AvatarStack';
import ConfirmDialog from '../../components/ConfirmDialog';
import FavoriteButton from '../../components/FavoriteButton';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { FolderMeeting, FolderMember, FolderPendingAgenda, WorkspaceMember } from '../../types/workspace';
import copyIcon from '../../assets/icons/copy.svg';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import editIcon from '../../assets/icons/create-sm.svg';
import groupIcon from '../../assets/icons/group-add-sm.svg';
import logoutIcon from '../../assets/icons/logout.svg';
import moreIcon from '../../assets/icons/more-vert.svg';
import moveIcon from '../../assets/icons/folder-sm.svg';
import starIcon from '../../assets/icons/star-outline.svg';
import MoveMeetingModal from '../../components/MoveMeetingModal';
import ActionMenu from '../workspace/ActionMenu';
import FolderNameModal from '../workspace/FolderNameModal';
import FolderMembersModal from './FolderMembersModal';
import MeetingTable, { type MeetingSort, type SortKey } from './MeetingTable';
import styles from './FolderPage.module.css';

const SEPARATOR_ICON_SIZE = 16;
const BUTTON_ICON_SIZE = 20;
const MORE_ICON_SIZE = 24;
// MSG-031 (서버 FOLDER_NAME_DUPLICATED)
const DUPLICATE_FOLDER_MESSAGE = '같은 이름의 폴더가 이미 있습니다. 다른 이름을 입력해 주세요.';

// REQ-167 정렬 메뉴: 최신순(기본), 오래된순, 회의명순
const SORT_OPTIONS: { value: string; label: string; sort: MeetingSort }[] = [
  { value: 'newest', label: '최신순', sort: { key: 'date', isAscending: false } },
  { value: 'oldest', label: '오래된순', sort: { key: 'date', isAscending: true } },
  { value: 'title', label: '회의명순', sort: { key: 'title', isAscending: true } },
];
const SORT_KEYS: SortKey[] = ['title', 'date', 'status', 'writer'];

/** 주소의 ?sort=date&asc=0&page=2 를 읽는다 (REQ-180 뒤로 가기에도 정렬, 페이지가 남는다) */
function sortOf(params: URLSearchParams): MeetingSort {
  const key = params.get('sort') as SortKey | null;
  return key && SORT_KEYS.includes(key) ? { key, isAscending: params.get('asc') === '1' } : SORT_OPTIONS[0].sort;
}

type Dialog =
  | { type: 'members' }
  | { type: 'leave' }
  | { type: 'rename' }
  | { type: 'delete' }
  | { type: 'move'; meeting: FolderMeeting };

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
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = sortOf(searchParams);
  const page = Math.max(0, Number(searchParams.get('page') ?? '1') - 1);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLButtonElement>(null);
  // 즐겨찾기 버튼은 스스로 상태를 불러오므로 메뉴에서 바꾸면 다시 그린다
  const [favoriteKey, setFavoriteKey] = useState(0);
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
  const reloadMeetings = async () => setMeetings(await listFolderMeetingRows(id));

  const changeView = (next: { sort?: MeetingSort; page?: number }) => {
    const params = new URLSearchParams(searchParams);
    const nextSort = next.sort ?? sort;
    params.set('sort', nextSort.key);
    params.set('asc', nextSort.isAscending ? '1' : '0');
    params.set('page', String((next.page ?? (next.sort ? 0 : page)) + 1));
    setSearchParams(params, { replace: true });
  };

  // REQ-166 회의 삭제: 쓰레기통으로. 토스트의 [되돌리기]는 5초 (MSG-063)
  const removeMeeting = async (meeting: FolderMeeting) => {
    try {
      await trashMeeting(meeting.meetingId);
      setMeetings((prev) => prev.filter(({ meetingId }) => meetingId !== meeting.meetingId));
      setToast({
        text: `'${meeting.title}'을 삭제했어요.`,
        variant: 'info',
        action: {
          label: '되돌리기',
          onClick: () => {
            restoreMeeting(meeting.meetingId)
              .then(reloadMeetings)
              .catch(showError);
          },
        },
      });
    } catch (error) {
      showError(error);
    }
  };

  // REQ-166 링크 복사 (MSG-064)
  const copyMeetingLink = async (meeting: FolderMeeting) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${meetingPath(meeting)}`);
      setToast({ text: '링크를 복사했어요.', variant: 'success' });
    } catch {
      showError(new Error('링크를 복사하지 못했어요. 다시 시도해 주세요.'));
    }
  };

  const meetingMenu = (meeting: FolderMeeting) => [
    // REQ-064 회의 정보 수정은 시작 전에만
    ...(meeting.status === 'scheduled'
      ? [{ label: '회의 정보 수정', icon: editIcon, onSelect: () => navigate(`/meetings/${meeting.meetingId}/edit`) }]
      : []),
    { label: '다른 폴더로 이동', icon: moveIcon, onSelect: () => setDialog({ type: 'move', meeting }) },
    { label: '링크 복사', icon: copyIcon, onSelect: () => void copyMeetingLink(meeting) },
    ...(meeting.status === 'inProgress'
      ? []
      : [{ label: '회의 삭제', icon: deleteIcon, isDanger: true, onSelect: () => void removeMeeting(meeting) }]),
  ];

  // REQ-153 폴더 메뉴의 [즐겨찾기에 추가]
  const addFavorite = async () => {
    if (!folder) {
      return;
    }
    try {
      await setFavorite({ type: 'folder', workspaceId: folder.workspaceId, folderId: folder.folderId }, true);
      setFavoriteKey((value) => value + 1);
      setToast({ text: '즐겨찾기에 추가했어요.', variant: 'success' });
    } catch (error) {
      showError(error);
    }
  };

  // REQ-058 폴더 삭제 (쓰레기통으로)
  const removeFolder = async () => {
    closeDialog();
    if (!folder) {
      return;
    }
    try {
      await deleteFolder(folder.folderId);
      navigate(`/workspaces/${folder.workspaceId}`, { replace: true });
    } catch (error) {
      showError(error);
    }
  };

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

  // REQ-178 불러오는 동안 회색 자리
  if (!folder) {
    return (
      <AppLayout className={styles.page}>
        {toast && <Toast message={toast} onClose={closeToast} />}
        <Skeleton width={280} height={32} />
        <Skeleton height={240} />
      </AppLayout>
    );
  }

  return (
    <AppLayout className={styles.page} workspaceId={folder.workspaceId}>
      {toast && <Toast message={toast} onClose={closeToast} />}

      <div className={styles.head}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <button type="button" className={styles.crumb} onClick={() => navigate(`/workspaces/${folder.workspaceId}`)}>
            워크스페이스
          </button>
          <Icon src={separatorIcon} size={SEPARATOR_ICON_SIZE} className={styles.separator} />
          <span aria-current="page" className={styles.current}>
            {folder.name}
          </span>
        </nav>
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{folder.name}</h1>
            <FavoriteButton
              key={favoriteKey}
              target={{ type: 'folder', workspaceId: folder.workspaceId, folderId: folder.folderId }}
              name={folder.name}
              onError={(text) => setToast({ text, variant: 'error' })}
            />
            {/* REQ-165 폴더 ⋮ 메뉴 */}
            <span className={styles.menuAnchor}>
              <button
                ref={folderMenuRef}
                type="button"
                className={styles.iconButton}
                aria-label="폴더 메뉴"
                aria-haspopup="menu"
                aria-expanded={isFolderMenuOpen}
                onClick={() => setIsFolderMenuOpen((value) => !value)}
              >
                <Icon src={moreIcon} size={MORE_ICON_SIZE} />
              </button>
              {isFolderMenuOpen && (
                <ActionMenu
                  label="폴더 메뉴"
                  anchorRef={folderMenuRef}
                  onClose={() => setIsFolderMenuOpen(false)}
                  items={[
                    // 이름 바꾸기, 삭제는 폴더를 만든 사람만 (기본 폴더 이름은 워크스페이스 소유자)
                    ...(folder.isOwner || (folder.isDefault && isWorkspaceOwner)
                      ? [{ label: '폴더 이름 바꾸기', icon: editIcon, onSelect: () => setDialog({ type: 'rename' }) }]
                      : []),
                    { label: '멤버 관리', icon: groupIcon, onSelect: () => void openMembers() },
                    { label: '즐겨찾기에 추가', icon: starIcon, onSelect: () => void addFavorite() },
                    ...(!folder.isDefault
                      ? [{ label: '폴더 나가기', icon: logoutIcon, onSelect: () => setDialog({ type: 'leave' }) }]
                      : []),
                    ...(folder.isOwner && !folder.isDefault
                      ? [{ label: '폴더 삭제', icon: deleteIcon, isDanger: true, onSelect: () => setDialog({ type: 'delete' }) }]
                      : []),
                  ].map((item) => ({
                    ...item,
                    onSelect: () => {
                      setIsFolderMenuOpen(false);
                      item.onSelect();
                    },
                  }))}
                />
              )}
            </span>
          </div>
          {/* REQ-050 폴더 멤버 모두 새 회의를 만들 수 있다 */}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => navigate(`/folders/${folder.folderId}/meetings/new`)}
          >
            <Icon src={addIcon} size={BUTTON_ICON_SIZE} />새 회의
          </button>
        </div>
      </div>

      <div className={styles.columns}>
        <section className={styles.main} aria-labelledby="meetings-title">
          <div className={styles.sectionHead}>
            <h2 id="meetings-title" className={styles.sectionTitle}>
              회의 목록
            </h2>
            {/* REQ-167 정렬 */}
            <select
              className={styles.sortSelect}
              aria-label="정렬"
              value={
                SORT_OPTIONS.find(
                  (option) => option.sort.key === sort.key && option.sort.isAscending === sort.isAscending,
                )?.value ?? ''
              }
              onChange={(event) => {
                const option = SORT_OPTIONS.find(({ value }) => value === event.target.value);
                if (option) {
                  changeView({ sort: option.sort });
                }
              }}
            >
              {!SORT_OPTIONS.some((option) => option.sort.key === sort.key && option.sort.isAscending === sort.isAscending) && (
                <option value="">직접 정렬</option>
              )}
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {/* REQ-053 회의 목록 오른쪽 위 [회의록 아카이브] */}
            <button
              type="button"
              className={styles.textButton}
              onClick={() => navigate(`/workspaces/${folder.workspaceId}/archive`)}
            >
              회의록 아카이브
            </button>
          </div>
          <MeetingTable
            meetings={meetings}
            onOpen={(meeting) => navigate(meetingPath(meeting))}
            sort={sort}
            onSortChange={(next) => changeView({ sort: next })}
            page={page}
            onPageChange={(next) => changeView({ page: next })}
            rowMenu={meetingMenu}
            empty={
              // MSG-034 (와이어프레임 ProjectEmptyPage 문구)
              <EmptyState
                title="아직 회의가 없어요"
                description="첫 회의를 만들고 안건을 정리해 보세요"
                action={
                  <Button variant="primary" size="md" onClick={() => navigate(`/folders/${folder.folderId}/meetings/new`)}>
                    새 회의 만들기
                  </Button>
                }
              />
            }
          />
        </section>

        <aside className={styles.side}>
          <section className={styles.section} aria-labelledby="folder-members-title">
            <h2 id="folder-members-title" className={styles.sectionTitle}>
              멤버
            </h2>
            <div className={styles.memberCard}>
              <AvatarStack members={members} label={`폴더 멤버 ${members.length}명`} />
              <button type="button" className={styles.textButton} onClick={openMembers}>
                멤버 관리
              </button>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="pending-title">
            <div className={styles.pendingHead}>
              <div className={styles.pendingTitleGroup}>
                <h2 id="pending-title" className={styles.sectionTitle}>
                  남은 안건
                </h2>
                <p className={styles.pendingCaption}>이전 회의에서 결정하지 못한 안건이에요</p>
              </div>
              <span className={styles.countBadge}>{pendingAgendas.length}개</span>
            </div>
            <div className={styles.pendingCard}>
              {pendingAgendas.length === 0 ? (
                // MSG-035 (와이어프레임 ProjectEmptyPage 문구)
                <EmptyState title="남은 안건이 없어요" description="회의에서 결정되지 않은 안건이 여기에 모여요" />
              ) : (
                <ul className={styles.pendingList}>
                  {pendingAgendas.map((agenda) => (
                    <li key={agenda.pendingAgendaId} className={styles.pendingItem}>
                      <span className={styles.pendingTitle}>{agenda.title}</span>
                      <span className={styles.pendingMeta}>
                        {agenda.fromMeetingTitle}
                        <span className={styles.metaDivider} aria-hidden="true" />
                        {agenda.carriedAt.replaceAll('-', '.')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* REQ-139 기본 폴더에서는 나갈 수 없다 */}
          {!folder.isDefault && (
            <button type="button" className={`${styles.textButton} ${styles.leave}`} onClick={() => setDialog({ type: 'leave' })}>
              이 폴더 나가기
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
      {dialog?.type === 'move' && (
        <MoveMeetingModal
          meetingId={dialog.meeting.meetingId}
          title={dialog.meeting.title}
          workspaceId={folder.workspaceId}
          currentFolderId={folder.folderId}
          onMoved={(folderName) => {
            closeDialog();
            setMeetings((prev) => prev.filter(({ meetingId }) => meetingId !== dialog.meeting.meetingId));
            setToast({ text: `'${dialog.meeting.title}'을 ${folderName} 폴더로 옮겼어요.`, variant: 'success' });
          }}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'rename' && (
        <FolderNameModal
          title="폴더 이름 바꾸기"
          description="새 폴더 이름을 입력해 주세요"
          submitLabel="저장"
          initialName={folder.name}
          siblingNames={[]}
          onSubmit={async (name) => {
            await renameFolder(folder.folderId, name);
            setFolder({ ...folder, name });
            closeDialog();
          }}
          toErrorMessage={(error) =>
            isApiError(error, WORKSPACE_ERROR_CODES.folderNameDuplicated) ? DUPLICATE_FOLDER_MESSAGE : errorMessage(error)
          }
          onClose={closeDialog}
        />
      )}
      {dialog?.type === 'delete' && (
        // MSG-046
        <ConfirmDialog
          title="폴더를 삭제하시겠습니까?"
          message={'폴더 안의 회의와 회의록도 함께 삭제 목록으로 이동하며\n3개월 안에 복구할 수 있습니다.'}
          cancelLabel="취소"
          confirmLabel="삭제"
          isDanger
          onCancel={closeDialog}
          onConfirm={() => void removeFolder()}
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
