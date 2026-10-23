import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { createMeeting, listPendingAgendas, updateMeeting } from '../../api/meeting';
import { getMe } from '../../api/user';
import { listFolderMembers } from '../../api/workspace';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import type { Agenda, Meeting, MeetingBasicInfo, Member, PendingAgenda } from '../../types/meeting';
import { pendingAgendasFor } from '../../utils/pendingAgenda';
import AgendaEditor from './AgendaEditor';
import LoadPreviousSettings, { type PreviousSettings } from './LoadPreviousSettings';
import MemberChips from './MemberChips';
import styles from './MeetingCreatePage.module.css';

const ICON_SIZE = 20;
const BACK_ICON_SIZE = 24;
const TITLE_MAX_LENGTH = 100;
const LOCATION_MAX_LENGTH = 100;

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

type FieldErrors = Partial<Record<'title' | 'date' | 'time' | 'agendas' | 'writer', string>>;
type OpenMenu = 'attendee' | 'writer';

function pickBasicInfo({ title, date, startTime, endTime, location, attendees }: MeetingBasicInfo): MeetingBasicInfo {
  return { title, date, startTime, endTime, location, attendees };
}

/** REQ-071 필수 항목이 비어 있으면 칸 아래에 안내한다. 문구는 meeting-service 검증 메시지와 같게 맞췄다 */
function validate(form: MeetingForm, isEdit: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.title.trim()) {
    errors.title = '회의명을 입력해 주세요';
  }
  if (!form.date) {
    errors.date = '날짜를 선택해 주세요';
  }
  if (!form.startTime) {
    errors.time = '시작 시간을 선택해 주세요';
  } else if (!form.endTime) {
    errors.time = '종료 예정 시간을 선택해 주세요';
  } else if (form.endTime <= form.startTime) {
    errors.time = '종료 시간은 시작 시간보다 늦어야 해요';
  }
  // 정보 수정에서는 안건·회의록 작성자를 대기 화면에서 고친다
  if (!isEdit && form.agendas.length === 0) {
    errors.agendas = '안건을 1개 이상 등록해 주세요';
  }
  if (!isEdit && !form.writer) {
    errors.writer = '회의록 작성자를 선택해 주세요';
  }
  return errors;
}

/** REQ-059~072 회의 생성(프로젝트 폴더 안에서)·정보 수정 */
export default function MeetingCreatePage() {
  const navigate = useNavigate();
  const params = useParams();
  const editingMeeting = (useLocation().state as { meeting?: Meeting } | null)?.meeting;
  const isEdit = Boolean(params.meetingId);
  const folderId = editingMeeting?.folderId ?? Number(params.folderId);
  const [initialForm] = useState<MeetingForm>(() =>
    editingMeeting ? { ...pickBasicInfo(editingMeeting), agendas: [] } : EMPTY_FORM,
  );
  const [form, setForm] = useState<MeetingForm>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [folderMembers, setFolderMembers] = useState<Member[]>([]);
  const [pendingAgendas, setPendingAgendas] = useState<PendingAgenda[]>([]);
  const [me, setMe] = useState<Member>();
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [isLoadPreviousOpen, setIsLoadPreviousOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const closeMenu = useCallback(() => setOpenMenu(null), []);
  const memberAnchorRef = useRef<HTMLButtonElement>(null);
  const writerAnchorRef = useRef<HTMLButtonElement>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const hasFolder = Number.isInteger(folderId);
  // 만든 사람은 참석자로 자동으로 들어가므로(meeting-service) 회의록 작성자 후보에도 넣는다
  const writerCandidates =
    me && !form.attendees.some(({ userId }) => userId === me.userId) ? [me, ...form.attendees] : form.attendees;

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
    if (!hasFolder) {
      return undefined;
    }
    let isCurrent = true;
    Promise.all([listFolderMembers(folderId), isEdit ? [] : listPendingAgendas(folderId), getMe()])
      .then(([members, pending, loginUser]) => {
        if (isCurrent) {
          setFolderMembers(members);
          setPendingAgendas(pendingAgendasFor(pending));
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
      if ('title' in patch) {
        delete next.title;
      }
      if ('date' in patch) {
        delete next.date;
      }
      if ('startTime' in patch || 'endTime' in patch) {
        delete next.time;
      }
      if ('agendas' in patch) {
        delete next.agendas;
      }
      if ('writer' in patch) {
        delete next.writer;
      }
      return next;
    });
  };

  const toggleAttendee = (member: Member) => {
    const isSelected = form.attendees.some(({ userId }) => userId === member.userId);
    const attendees = isSelected
      ? form.attendees.filter(({ userId }) => userId !== member.userId)
      : [...form.attendees, member];
    // 참석자에서 빠진 사람은 회의록 작성자가 될 수 없다 (만든 사람은 늘 참석자라 그대로 둔다)
    const isWriterRemoved = isSelected && form.writer?.userId === member.userId && member.userId !== me?.userId;
    update(isWriterRemoved ? { attendees, writer: undefined } : { attendees });
  };

  const applyPreviousSettings = (settings: PreviousSettings) => {
    update(settings);
    setIsLoadPreviousOpen(false);
  };

  const handleBack = () => {
    if (isDirty) {
      setIsLeaveDialogOpen(true);
      return;
    }
    navigate(-1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form, isEdit);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isSubmitting) {
      return;
    }
    const basicInfo = pickBasicInfo({ ...form, title: form.title.trim(), location: form.location.trim() });
    setIsSubmitting(true);
    try {
      const saved = editingMeeting
        ? await updateMeeting({ ...editingMeeting, ...basicInfo })
        : await createMeeting(folderId, { ...basicInfo, agendas: form.agendas, writer: form.writer, materials: [] });
      navigate(`/meetings/${saved.meetingId}`, { replace: true });
    } catch (error) {
      setIsSubmitting(false);
      setToast({ text: errorMessage(error), variant: 'error' });
    }
  };

  return (
    <AppLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <div className={styles.header}>
          <button type="button" className={styles.iconButton} aria-label="뒤로 가기" onClick={handleBack}>
            <Placeholder size={BACK_ICON_SIZE} />
          </button>
          <h1 className={styles.title}>{isEdit ? '회의 정보 수정' : '새 회의 만들기'}</h1>
        </div>

        {!isEdit && (
          <button type="button" className={styles.loadPrevious} onClick={() => setIsLoadPreviousOpen(true)}>
            <span className={styles.boxLead}>
              <Placeholder size={ICON_SIZE} />
              이전 회의 설정 불러오기
            </span>
            <Placeholder size={ICON_SIZE} />
          </button>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>기본 정보</h2>
          <div className={styles.fields}>
            <TextField
              label="회의명 *"
              className={styles.field}
              placeholder="예 : 서비스 개선 방향 논의"
              maxLength={TITLE_MAX_LENGTH}
              value={form.title}
              error={errors.title}
              onChange={(event) => update({ title: event.target.value })}
              trailing={
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label="회의명 지우기"
                  onClick={() => update({ title: '' })}
                >
                  <Placeholder size={ICON_SIZE} />
                </button>
              }
            />
            <div className={styles.row}>
              <TextField
                label="회의날짜 *"
                className={styles.field}
                type="date"
                value={form.date}
                error={errors.date}
                onChange={(event) => update({ date: event.target.value })}
                leading={<Placeholder size={ICON_SIZE} />}
              />
              <div className={styles.field}>
                <span className={styles.label} id="meeting-time-label">
                  회의시간 *
                </span>
                <div
                  role="group"
                  aria-labelledby="meeting-time-label"
                  className={[styles.box, errors.time ? styles.boxError : ''].filter(Boolean).join(' ')}
                >
                  <Placeholder size={ICON_SIZE} />
                  <input
                    type="time"
                    aria-label="시작 시간"
                    className={styles.timeInput}
                    value={form.startTime}
                    onChange={(event) => update({ startTime: event.target.value })}
                  />
                  <span className={styles.timeSeparator}>~</span>
                  <input
                    type="time"
                    aria-label="종료 예정 시간"
                    className={styles.timeInput}
                    value={form.endTime}
                    onChange={(event) => update({ endTime: event.target.value })}
                  />
                </div>
                {errors.time && <p className={styles.error}>{errors.time}</p>}
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.label}>참석자</span>
              <MemberChips members={form.attendees} onRemove={toggleAttendee} />
              <div className={styles.menuAnchor}>
                <button
                  ref={memberAnchorRef}
                  type="button"
                  className={`${styles.box} ${styles.boxButton}`}
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'attendee'}
                  onClick={() => setOpenMenu((menu) => (menu === 'attendee' ? null : 'attendee'))}
                >
                  <Placeholder size={ICON_SIZE} />
                  <span className={styles.placeholderText}>참석자 선택</span>
                </button>
                {openMenu === 'attendee' && (
                  <DropdownMenu
                    label="참석자 선택"
                    emptyText="폴더 멤버가 없어요"
                    anchorRef={memberAnchorRef}
                    items={folderMembers.map((member) => ({
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
              </div>
            </div>
            <TextField
              label="장소"
              className={styles.field}
              placeholder="회의 장소 입력"
              maxLength={LOCATION_MAX_LENGTH}
              value={form.location}
              onChange={(event) => update({ location: event.target.value })}
              leading={<Placeholder size={ICON_SIZE} />}
            />
          </div>
        </section>

        {!isEdit && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>안건 *</h2>
              <AgendaEditor
                agendas={form.agendas}
                pendingAgendas={pendingAgendas}
                onChange={(agendas) => update({ agendas })}
              />
              {errors.agendas && <p className={styles.error}>{errors.agendas}</p>}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>회의록 작성자 *</h2>
              <div className={`${styles.field} ${styles.menuAnchor}`}>
                <button
                  ref={writerAnchorRef}
                  type="button"
                  className={[styles.box, styles.boxButton, errors.writer ? styles.boxError : ''].filter(Boolean).join(' ')}
                  aria-label="회의록 작성자 선택"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'writer'}
                  onClick={() => setOpenMenu((menu) => (menu === 'writer' ? null : 'writer'))}
                >
                  <Placeholder size={ICON_SIZE} />
                  {form.writer ? form.writer.name : <span className={styles.placeholderText}>작성자 선택하기</span>}
                </button>
                {openMenu === 'writer' && (
                  <DropdownMenu
                    label="회의록 작성자"
                    emptyText="회의 참석자를 먼저 선택해 주세요"
                    anchorRef={writerAnchorRef}
                    items={writerCandidates.map((member) => ({
                      id: String(member.userId),
                      label: member.name,
                      isSelected: member.userId === form.writer?.userId,
                    }))}
                    onSelect={(id) => {
                      update({ writer: writerCandidates.find(({ userId }) => String(userId) === id) });
                      closeMenu();
                    }}
                    onClose={closeMenu}
                  />
                )}
                {errors.writer ? (
                  <p className={styles.error}>{errors.writer}</p>
                ) : (
                  <p className={styles.caption}>회의 참여자 중 한 명을 선택합니다.</p>
                )}
              </div>
            </section>
          </>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isEdit ? '저장' : '회의 생성'}
        </Button>
      </form>

      {isLoadPreviousOpen && (
        <LoadPreviousSettings
          folderId={folderId}
          onBack={() => setIsLoadPreviousOpen(false)}
          onApply={applyPreviousSettings}
        />
      )}
      {isLeaveDialogOpen && (
        <ConfirmDialog
          title="작성 중인 회의가 있어요"
          message={'지금 나가면 입력한 내용이 모두 사라져요.\n정말 나가시겠어요?'}
          cancelLabel="계속 작성하기"
          confirmLabel="나가기"
          onCancel={() => setIsLeaveDialogOpen(false)}
          onConfirm={() => navigate(-1)}
        />
      )}
    </AppLayout>
  );
}
