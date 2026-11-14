import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { createMeeting, updateMeeting } from '../../api/meeting';
import { getMe } from '../../api/user';
import { getFolder, getWorkspace, listFolderMembers, listFolders } from '../../api/workspace';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DatePicker from '../../components/DatePicker';
import DropdownMenu from '../../components/DropdownMenu';
import Modal from '../../components/Modal';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import chevronRightIcon from '../../assets/icons/chevron-right.svg';
import clockIcon from '../../assets/icons/clock.svg';
import groupAddIcon from '../../assets/icons/group-add.svg';
import historyIcon from '../../assets/icons/history.svg';
import pinIcon from '../../assets/icons/pin.svg';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Agenda, Meeting, MeetingBasicInfo, Member } from '../../types/meeting';
import FolderPage from '../folder/FolderPage';
import LoadPreviousSettings, { type PreviousSettings } from './LoadPreviousSettings';
import MeetingWaitingPage from './MeetingWaitingPage';
import MemberChips from './MemberChips';
import styles from './MeetingCreatePage.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
const TITLE_MAX_LENGTH = 100;
const LOCATION_MAX_LENGTH = 100;
const SLOT_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;

/** 디자인 CreateMeetingModal 회의 길이 칩. custom이면 종료 시간을 직접 고른다 */
type Duration = 30 | 60 | 90 | 'custom';
const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 90, label: '1시간 30분' },
  { value: 'custom', label: '직접 입력' },
];
/** 직접 입력의 종료 시간 후보: 시작 시간에서 얼마나 뒤인지 */
const END_OFFSETS = [30, 60, 90, 120, 180];
const DEFAULT_DURATION = 60 satisfies Duration;
/**
 * 디자인 Version02는 안건을 대기 화면에서 정하지만 meeting-service는 생성할 때 안건 1개를 꼭 받는다.
 * 그래서 고칠 자리만 만들어 두고, 대기 화면 [안건 수정]에서 바꾼다
 */
const PLACEHOLDER_AGENDA: Agenda = { id: 'placeholder', title: '논의할 안건', decisionPoints: ['결정할 사항'] };

/** 기본 정보와, 새 회의일 때 함께 정하는 안건·회의록 작성자 (REQ-065~070) */
interface MeetingForm extends MeetingBasicInfo {
  agendas: Agenda[];
  writer?: Member;
}

const EMPTY_FORM: MeetingForm = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  attendees: [],
  agendas: [],
};

type FieldErrors = Partial<Record<'title' | 'date' | 'startTime' | 'endTime', string>>;
type OpenMenu = 'attendee' | 'startTime' | 'endTime' | 'folder';

function pickBasicInfo({ title, date, startTime, endTime, location, attendees }: MeetingBasicInfo): MeetingBasicInfo {
  return { title, date, startTime, endTime, location, attendees };
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function toTime(minutes: number) {
  const clamped = Math.min(Math.max(minutes, 0), MINUTES_PER_DAY - 1);
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}시간` : '', rest ? `${rest}분` : ''].filter(Boolean).join(' ');
}

/** 시작 시간 후보: 30분 단위 */
const START_SLOTS = Array.from({ length: MINUTES_PER_DAY / SLOT_MINUTES }, (_, index) => toTime(index * SLOT_MINUTES));

/** 정보 수정으로 열 때 저장된 길이가 칩 중 하나면 그 칩을, 아니면 직접 입력을 고른다 */
function durationOf(form: MeetingBasicInfo): Duration {
  if (!form.startTime || !form.endTime) {
    return DEFAULT_DURATION;
  }
  const minutes = toMinutes(form.endTime) - toMinutes(form.startTime);
  return minutes === 30 || minutes === 60 || minutes === 90 ? minutes : 'custom';
}

/** REQ-071 필수 항목이 비어 있으면 칸 아래에 안내한다. 문구는 meeting-service 검증 메시지와 같게 맞췄다 */
function validate(form: MeetingForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) {
    errors.title = '회의명을 입력해 주세요';
  }
  if (!form.date) {
    errors.date = '날짜를 선택해 주세요';
  }
  if (!form.startTime) {
    errors.startTime = '시작 시간을 선택해 주세요';
  } else if (!form.endTime) {
    errors.endTime = '종료 예정 시간을 선택해 주세요';
  } else if (form.endTime <= form.startTime) {
    errors.endTime = '종료 시간은 시작 시간보다 늦게 설정해 주세요.';
  }
  return errors;
}

/**
 * REQ-059~072 회의 생성(프로젝트 폴더 화면 위 창)·정보 수정(회의 대기 화면 위 창). 디자인 Version02 CreateMeetingModal.
 * 회의록 작성자는 만든 사람으로 넣고 대기 화면에서 바꾼다. 안건은 meeting-service가 생성할 때 꼭 받아서 창 안에서 고른다
 */
export default function MeetingCreatePage() {
  const navigate = useNavigate();
  const params = useParams();
  const titleId = useId();
  const editingMeeting = (useLocation().state as { meeting?: Meeting } | null)?.meeting;
  const isEdit = Boolean(params.meetingId);
  const routeFolderId = editingMeeting?.folderId ?? Number(params.folderId);
  // REQ-169 회의를 저장할 프로젝트 폴더. 폴더 화면의 [새 회의]로 들어오면 그 폴더가 골라져 있다 (수정할 때는 바꾸지 않는다)
  const [selectedFolderId, setSelectedFolderId] = useState(routeFolderId);
  const [folderOptions, setFolderOptions] = useState<{ folderId: number; name: string }[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const folderId = isEdit ? routeFolderId : selectedFolderId;
  const [initialForm] = useState<MeetingForm>(() =>
    editingMeeting ? { ...pickBasicInfo(editingMeeting), agendas: [] } : EMPTY_FORM,
  );
  const [form, setForm] = useState<MeetingForm>(initialForm);
  const [duration, setDuration] = useState<Duration>(() => durationOf(initialForm));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [folderMembers, setFolderMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Member>();
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [isLoadPreviousOpen, setIsLoadPreviousOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const memberAnchorRef = useRef<HTMLButtonElement>(null);
  const folderAnchorRef = useRef<HTMLButtonElement>(null);
  const startAnchorRef = useRef<HTMLButtonElement>(null);
  const endAnchorRef = useRef<HTMLButtonElement>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const hasFolder = Number.isInteger(folderId);
  const closePath = isEdit ? `/meetings/${params.meetingId}` : `/folders/${routeFolderId}`;
  // REQ-072 입력한 내용이 있으면 취소, 사이드바 등 어느 쪽으로 나가든 먼저 묻는다. 저장하고 넘어갈 때는 묻지 않는다
  const leaveBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !isSubmitting && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }
    // REQ-072 새로고침·탭 닫기로 나갈 때도 브라우저 확인 창을 띄운다
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (isEdit || !Number.isInteger(routeFolderId)) {
      return undefined;
    }
    let isCurrent = true;
    getFolder(routeFolderId)
      .then((folder) => Promise.all([listFolders(folder.workspaceId), getWorkspace(folder.workspaceId)]))
      .then(([folders, workspace]) => {
        if (isCurrent) {
          setFolderOptions(folders);
          setWorkspaceName(workspace.name);
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [isEdit, routeFolderId]);

  useEffect(() => {
    if (!hasFolder) {
      return undefined;
    }
    let isCurrent = true;
    Promise.all([listFolderMembers(folderId), getMe()])
      .then(([members, loginUser]) => {
        if (isCurrent) {
          setFolderMembers(members);
          setMe(loginUser);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setToast({ text: errorMessage(error), variant: 'error' });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [folderId, hasFolder, isEdit]);

  if (isEdit && !editingMeeting) {
    return <Navigate to={`/meetings/${params.meetingId}`} replace />;
  }
  if (!hasFolder) {
    return <Navigate to="/home" replace />;
  }

  const update = (patch: Partial<MeetingForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        delete next[key as keyof FieldErrors];
      }
      if ('startTime' in patch) {
        delete next.endTime;
      }
      return next;
    });
  };

  /** 칩으로 길이를 고르면 시작 시간에 더해 종료 시간을 정한다 */
  const endFor = (startTime: string, nextDuration: Duration, currentEnd: string) => {
    if (!startTime) {
      return currentEnd;
    }
    return nextDuration === 'custom' ? currentEnd : toTime(toMinutes(startTime) + nextDuration);
  };

  const selectStartTime = (startTime: string) => {
    update({ startTime, endTime: endFor(startTime, duration, form.endTime) });
    closeMenu();
  };

  const selectDuration = (nextDuration: Duration) => {
    setDuration(nextDuration);
    const fallbackEnd = form.startTime ? toTime(toMinutes(form.startTime) + DEFAULT_DURATION) : '';
    update({ endTime: endFor(form.startTime, nextDuration, form.endTime || fallbackEnd) });
  };

  const toggleAttendee = (member: Member) => {
    const isSelected = form.attendees.some(({ userId }) => userId === member.userId);
    const attendees = isSelected
      ? form.attendees.filter(({ userId }) => userId !== member.userId)
      : [...form.attendees, member];
    update({ attendees });
  };

  const applyPreviousSettings = (settings: PreviousSettings) => {
    update(settings);
    setIsLoadPreviousOpen(false);
  };

  const handleClose = () => navigate(closePath);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isSubmitting) {
      return;
    }
    const basicInfo = pickBasicInfo({ ...form, title: form.title.trim(), location: form.location.trim() });
    setIsSubmitting(true);
    try {
      const saved = editingMeeting
        ? await updateMeeting({ ...editingMeeting, ...basicInfo })
        : await createMeeting(folderId, {
            ...basicInfo,
            agendas: form.agendas.length > 0 ? form.agendas : [PLACEHOLDER_AGENDA],
            writer: form.writer ?? me,
            materials: [],
          });
      navigate(`/meetings/${saved.meetingId}`, { replace: true });
    } catch (error) {
      setIsSubmitting(false);
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  const startMinutes = form.startTime ? toMinutes(form.startTime) : undefined;
  const endItems =
    startMinutes === undefined
      ? []
      : END_OFFSETS.filter((offset) => startMinutes + offset < MINUTES_PER_DAY).map((offset) => {
          const time = toTime(startMinutes + offset);
          return { id: time, label: `${time} (${durationLabel(offset)})`, isSelected: time === form.endTime };
        });

  return (
    <>
      {isEdit ? <MeetingWaitingPage /> : <FolderPage />}
      {toast && <Toast message={toast} onClose={closeToast} />}
      {!isLoadPreviousOpen && (
        <Modal labelledBy={titleId} onClose={leaveBlocker.state === 'blocked' ? undefined : handleClose} className={styles.modal}>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.scroll}>
              <div className={styles.titleGroup}>
                <h1 id={titleId} className={styles.title}>
                  {isEdit ? '회의 정보 수정' : '새 회의 만들기'}
                </h1>
                <p className={styles.subtitle}>
                  {isEdit
                    ? '바꾼 내용은 참석자에게 알림으로 가요'
                    : '기본 정보만 입력하면 돼요. 안건과 자료는 다음 화면에서 준비해요'}
                </p>
              </div>

              {!isEdit && (
                <button type="button" className={styles.loadPrevious} onClick={() => setIsLoadPreviousOpen(true)}>
                  <Icon src={historyIcon} size={SMALL_ICON_SIZE} />
                  이전 회의 설정 불러오기
                </button>
              )}

              <div className={styles.fields}>
                {!isEdit && folderOptions.length > 0 && (
                  <div className={`${styles.field} ${styles.menuAnchor}`}>
                    <span className={styles.label}>프로젝트 폴더</span>
                    <button
                      ref={folderAnchorRef}
                      type="button"
                      className={[styles.box, openMenu === 'folder' ? styles.boxOpen : ''].filter(Boolean).join(' ')}
                      aria-label="프로젝트 폴더 선택"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'folder'}
                      onClick={() => setOpenMenu((menu) => (menu === 'folder' ? null : 'folder'))}
                    >
                      <span className={styles.value}>
                        {[workspaceName, folderOptions.find(({ folderId: id }) => id === selectedFolderId)?.name]
                          .filter(Boolean)
                          .join(' / ')}
                      </span>
                      <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.trailingIcon} />
                    </button>
                    {openMenu === 'folder' && (
                      <DropdownMenu
                        label="프로젝트 폴더"
                        emptyText="폴더가 없어요"
                        anchorRef={folderAnchorRef}
                        className={styles.folderMenu}
                        items={folderOptions.map((folder) => ({
                          id: String(folder.folderId),
                          label: workspaceName ? `${workspaceName} / ${folder.name}` : folder.name,
                          isSelected: folder.folderId === selectedFolderId,
                        }))}
                        onSelect={(id) => {
                          // 참석자는 폴더마다 달라 폴더를 바꾸면 다시 고른다
                          setSelectedFolderId(Number(id));
                          setForm((prev) => ({ ...prev, attendees: [] }));
                          closeMenu();
                        }}
                        onClose={closeMenu}
                      />
                    )}
                    <span className={styles.helper}>프로젝트 화면에서 만들면 자동으로 채워져요</span>
                  </div>
                )}

                <TextField
                  label="회의명"
                  placeholder="예: 서비스 개선 방향 논의"
                  maxLength={TITLE_MAX_LENGTH}
                  value={form.title}
                  error={errors.title}
                  onChange={(event) => update({ title: event.target.value })}
                />

                <div className={styles.row}>
                  <div className={styles.field}>
                    <span className={styles.label}>회의 날짜</span>
                    <DatePicker
                      label="회의 날짜 선택"
                      value={form.date}
                      error={Boolean(errors.date)}
                      onChange={(date) => update({ date })}
                    />
                    {errors.date && <p className={styles.error}>{errors.date}</p>}
                  </div>
                  <div className={`${styles.field} ${styles.menuAnchor}`}>
                    <span className={styles.label}>시작 시간</span>
                    <button
                      ref={startAnchorRef}
                      type="button"
                      className={[
                        styles.box,
                        openMenu === 'startTime' ? styles.boxOpen : '',
                        errors.startTime ? styles.boxError : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label="시작 시간 선택"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'startTime'}
                      onClick={() => setOpenMenu((menu) => (menu === 'startTime' ? null : 'startTime'))}
                    >
                      <Icon src={clockIcon} size={ICON_SIZE} className={styles.leadingIcon} />
                      <span className={form.startTime ? styles.value : styles.placeholderText}>
                        {form.startTime || '시간 선택'}
                      </span>
                      <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.trailingIcon} />
                    </button>
                    {openMenu === 'startTime' && (
                      <DropdownMenu
                        label="시작 시간"
                        emptyText="고를 수 있는 시간이 없어요"
                        anchorRef={startAnchorRef}
                        className={styles.timeMenu}
                        items={START_SLOTS.map((time) => ({ id: time, label: time, isSelected: time === form.startTime }))}
                        onSelect={selectStartTime}
                        onClose={closeMenu}
                      />
                    )}
                    {errors.startTime && <p className={styles.error}>{errors.startTime}</p>}
                  </div>
                </div>

                <div className={styles.durationField}>
                  <span className={styles.durationLabel} id={`${titleId}-duration`}>
                    회의 길이
                  </span>
                  <div className={styles.chips} role="radiogroup" aria-labelledby={`${titleId}-duration`}>
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={duration === option.value}
                        className={[styles.chip, duration === option.value ? styles.chipSelected : ''].filter(Boolean).join(' ')}
                        onClick={() => selectDuration(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {duration === 'custom' && (
                  <div className={`${styles.field} ${styles.menuAnchor}`}>
                    <span className={styles.label}>종료 시간</span>
                    <button
                      ref={endAnchorRef}
                      type="button"
                      className={[
                        styles.box,
                        openMenu === 'endTime' ? styles.boxOpen : '',
                        errors.endTime ? styles.boxError : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-label="종료 시간 선택"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'endTime'}
                      onClick={() => setOpenMenu((menu) => (menu === 'endTime' ? null : 'endTime'))}
                    >
                      <Icon src={clockIcon} size={ICON_SIZE} className={styles.leadingIcon} />
                      <span className={form.endTime ? styles.value : styles.placeholderText}>
                        {form.endTime || '시간 선택'}
                      </span>
                      <Icon src={chevronDownIcon} size={ICON_SIZE} className={styles.trailingIcon} />
                    </button>
                    {openMenu === 'endTime' && (
                      <DropdownMenu
                        label="종료 시간"
                        emptyText="시작 시간을 먼저 골라 주세요"
                        anchorRef={endAnchorRef}
                        className={styles.endMenu}
                        items={endItems}
                        onSelect={(time) => {
                          update({ endTime: time });
                          closeMenu();
                        }}
                        onClose={closeMenu}
                      />
                    )}
                    {errors.endTime && <p className={styles.error}>{errors.endTime}</p>}
                  </div>
                )}
                {duration !== 'custom' && errors.endTime && <p className={styles.error}>{errors.endTime}</p>}

                <div className={`${styles.field} ${styles.menuAnchor}`}>
                  <span className={styles.label}>참석자 (선택)</span>
                  <button
                    ref={memberAnchorRef}
                    type="button"
                    className={[styles.box, openMenu === 'attendee' ? styles.boxOpen : ''].filter(Boolean).join(' ')}
                    aria-haspopup="listbox"
                    aria-expanded={openMenu === 'attendee'}
                    onClick={() => setOpenMenu((menu) => (menu === 'attendee' ? null : 'attendee'))}
                  >
                    <Icon src={groupAddIcon} size={ICON_SIZE} className={styles.leadingIcon} />
                    <span className={styles.placeholderText}>참석자 선택</span>
                    <Icon src={chevronRightIcon} size={ICON_SIZE} className={styles.trailingIcon} />
                  </button>
                  {openMenu === 'attendee' && (
                    <DropdownMenu
                      label="참석자 선택"
                      emptyText="폴더 멤버가 없어요"
                      anchorRef={memberAnchorRef}
                      items={folderMembers
                        .filter(({ userId }) => userId !== me?.userId)
                        .map((member) => ({
                          id: String(member.userId),
                          label: member.name,
                          isSelected: form.attendees.some(({ userId }) => userId === member.userId),
                        }))}
                      onSelect={(id) => {
                        const member = folderMembers.find(({ userId }) => String(userId) === id);
                        if (member) {
                          toggleAttendee(member);
                        }
                      }}
                      onClose={closeMenu}
                    />
                  )}
                  <span className={styles.helper}>같은 워크스페이스 멤버 중에서 골라요</span>
                  <MemberChips members={form.attendees} onRemove={toggleAttendee} />
                </div>

                <TextField
                  label="장소 (선택)"
                  placeholder="회의 장소 입력"
                  maxLength={LOCATION_MAX_LENGTH}
                  value={form.location}
                  onChange={(event) => update({ location: event.target.value })}
                  leading={<Icon src={pinIcon} size={ICON_SIZE} className={styles.leadingIcon} />}
                />

              </div>
            </div>

            <div className={styles.actions}>
              <Button variant="secondary" size="md" onClick={handleClose}>
                취소
              </Button>
              {/* REQ-070 만드는 동안 버튼이 로딩 표시로 바뀌고 다시 누를 수 없다 */}
              <Button type="submit" size="md" isLoading={isSubmitting}>
                {isEdit ? '저장' : '회의 만들기'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {isLoadPreviousOpen && (
        <LoadPreviousSettings
          folderId={folderId}
          onBack={() => setIsLoadPreviousOpen(false)}
          onApply={applyPreviousSettings}
        />
      )}
      {leaveBlocker.state === 'blocked' && (
        <ConfirmDialog
          title="작성 중인 회의가 있어요"
          message="지금 나가면 입력한 내용이 모두 사라져요. 그래도 나갈까요?"
          cancelLabel="나가기"
          confirmLabel="계속 작성하기"
          onCancel={() => leaveBlocker.proceed()}
          onConfirm={() => leaveBlocker.reset()}
          onDismiss={() => leaveBlocker.reset()}
        />
      )}
    </>
  );
}
