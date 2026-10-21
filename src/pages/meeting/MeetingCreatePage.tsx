import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../../components/AppLayout';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import TextField from '../../components/TextField';
import { FOLDER_MEMBERS, MINUTES_TEMPLATES } from '../../mocks/meeting';
import type { Meeting, MeetingBasicInfo, Member } from '../../types/meeting';
import LoadPreviousSettings, { type PreviousSettings } from './LoadPreviousSettings';
import MemberChips from './MemberChips';
import styles from './MeetingCreatePage.module.css';

const ICON_SIZE = 20;
const BACK_ICON_SIZE = 24;
const TITLE_MAX_LENGTH = 100;
const LOCATION_MAX_LENGTH = 100;
// API 연동 전 임시 회의 ID. /meetings/new 경로와 겹치지 않게 한다
const PREVIEW_MEETING_ID = 'preview';

const EMPTY_FORM: MeetingBasicInfo = { title: '', date: '', startTime: '', endTime: '', location: '', attendees: [] };

type FieldErrors = Partial<Record<'title' | 'date' | 'time', string>>;

function pickBasicInfo({ title, date, startTime, endTime, location, attendees }: MeetingBasicInfo): MeetingBasicInfo {
  return { title, date, startTime, endTime, location, attendees };
}

/** REQ-071 필수 항목이 비어 있으면 칸 아래에 안내한다. 문구는 meeting-service 검증 메시지와 같게 맞췄다 */
function validate(form: MeetingBasicInfo): FieldErrors {
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
  return errors;
}

/** REQ-059~064, 070~072 회의 생성·정보 수정 */
export default function MeetingCreatePage() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const editingMeeting = (useLocation().state as { meeting?: Meeting } | null)?.meeting;
  const isEdit = Boolean(meetingId);
  const [initialForm] = useState<MeetingBasicInfo>(() => (editingMeeting ? pickBasicInfo(editingMeeting) : EMPTY_FORM));
  const [form, setForm] = useState<MeetingBasicInfo>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isMemberMenuOpen, setIsMemberMenuOpen] = useState(false);
  const [isLoadPreviousOpen, setIsLoadPreviousOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const memberAnchorRef = useRef<HTMLButtonElement>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }
    // REQ-072 새로고침·탭 닫기로 나갈 때도 브라우저 확인 창을 띄운다
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (isEdit && !editingMeeting) {
    return <Navigate to={`/meetings/${meetingId}`} replace />;
  }

  const update = (patch: Partial<MeetingBasicInfo>) => {
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
      return next;
    });
  };

  const toggleAttendee = (member: Member) => {
    const isSelected = form.attendees.some(({ userId }) => userId === member.userId);
    update({
      attendees: isSelected
        ? form.attendees.filter(({ userId }) => userId !== member.userId)
        : [...form.attendees, member],
    });
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    const basicInfo = { ...form, title: form.title.trim(), location: form.location.trim() };
    if (editingMeeting) {
      // TODO(API 연동): PUT /api/meetings/{meetingId} (REQ-064)
      navigate(`/meetings/${editingMeeting.meetingId}`, { state: { meeting: { ...editingMeeting, ...basicInfo } }, replace: true });
      return;
    }
    // TODO(API 연동): POST /api/folders/{folderId}/meetings. 안건·회의록 작성자는 대기 화면에서 정한다 (REQ-070)
    const meeting: Meeting = {
      ...basicInfo,
      meetingId: PREVIEW_MEETING_ID,
      agendas: [],
      templateId: MINUTES_TEMPLATES.find(({ isFavorite }) => isFavorite)?.templateId,
      materials: [],
    };
    navigate(`/meetings/${meeting.meetingId}`, { state: { meeting }, replace: true });
  };

  return (
    <AppLayout className={styles.page}>
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
                  aria-expanded={isMemberMenuOpen}
                  onClick={() => setIsMemberMenuOpen((value) => !value)}
                >
                  <Placeholder size={ICON_SIZE} />
                  <span className={styles.placeholderText}>참석자 선택</span>
                </button>
                {isMemberMenuOpen && (
                  <DropdownMenu
                    label="참석자 선택"
                    emptyText="폴더 멤버가 없어요"
                    anchorRef={memberAnchorRef}
                    items={FOLDER_MEMBERS.map((member) => ({
                      id: String(member.userId),
                      label: member.name,
                      isSelected: form.attendees.some(({ userId }) => userId === member.userId),
                    }))}
                    onSelect={(id) => {
                      const member = FOLDER_MEMBERS.find(({ userId }) => String(userId) === id);
                      if (member) {
                        toggleAttendee(member);
                      }
                    }}
                    onClose={() => setIsMemberMenuOpen(false)}
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

        <Button type="submit">{isEdit ? '저장' : '회의 생성'}</Button>
      </form>

      {isLoadPreviousOpen && (
        <LoadPreviousSettings onBack={() => setIsLoadPreviousOpen(false)} onApply={applyPreviousSettings} />
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
