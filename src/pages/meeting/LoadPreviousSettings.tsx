import { useEffect, useState } from 'react';
import { getMeetingDetail, listFolderMeetings, toDisplayDate, toMember } from '../../api/meeting';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import groupIcon from '../../assets/icons/group-add-sm.svg';
import infoIcon from '../../assets/icons/info.svg';
import locationIcon from '../../assets/icons/location.svg';
import searchIcon from '../../assets/icons/search.svg';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import type { MeetingBasicInfo, PreviousMeeting } from '../../types/meeting';
import styles from './LoadPreviousSettings.module.css';

const ICON_SIZE = 20;
const META_ICON_SIZE = 16;
// 최근 회의 몇 개까지 보여 줄지 (기획 미정, 임시)
const RECENT_MEETING_COUNT = 10;

export type PreviousSettings = Partial<Pick<MeetingBasicInfo, 'title' | 'attendees' | 'location'>>;
type SettingKey = keyof PreviousSettings;

const SETTING_OPTIONS: { key: SettingKey; label: string }[] = [
  { key: 'title', label: '회의명' },
  { key: 'attendees', label: '참석자' },
  { key: 'location', label: '장소' },
];

interface LoadPreviousSettingsProps {
  folderId: number;
  onBack: () => void;
  onApply: (settings: PreviousSettings) => void;
}

/** REQ-063 같은 프로젝트 폴더의 이전 회의에서 회의명·참석자·장소를 골라 불러온다 */
export default function LoadPreviousSettings({ folderId, onBack, onApply }: LoadPreviousSettingsProps) {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<number>();
  const [keys, setKeys] = useState<SettingKey[]>([]);
  const [previousMeetings, setPreviousMeetings] = useState<PreviousMeeting[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    // 목록에는 참석자·장소가 없어 회의마다 상세를 받는다
    listFolderMeetings(folderId, RECENT_MEETING_COUNT)
      .then((items) => Promise.all(items.map(({ meetingId }) => getMeetingDetail(meetingId))))
      .then((details) => details.map((detail) => ({
        meetingId: detail.meetingId,
        title: detail.title,
        date: toDisplayDate(detail.startAt),
        location: detail.location ?? '',
        attendees: detail.attendees.map(toMember),
      })))
      .catch(() => [])
      .then((loaded) => {
        if (isCurrent) {
          setPreviousMeetings(loaded);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [folderId]);

  const meetings = (previousMeetings ?? []).filter(({ title }) => title.includes(keyword.trim()));
  const selected = meetings.find(({ meetingId }) => meetingId === selectedId);

  const toggleKey = (key: SettingKey, checked: boolean) => {
    setKeys((prev) => (checked ? [...prev, key] : prev.filter((value) => value !== key)));
  };

  const apply = () => {
    if (!selected) {
      return;
    }
    const settings: PreviousSettings = {};
    if (keys.includes('title')) {
      settings.title = selected.title;
    }
    if (keys.includes('attendees')) {
      settings.attendees = selected.attendees;
    }
    if (keys.includes('location')) {
      settings.location = selected.location;
    }
    onApply(settings);
  };

  return (
    <Dialog
      title="이전 회의 설정 불러오기"
      description="같은 프로젝트 폴더의 회의를 골라 주세요"
      width="md"
      onClose={onBack}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onBack}>
            취소
          </Button>
          <Button size="md" disabled={!selected || keys.length === 0} onClick={apply}>
            선택한 설정 불러오기
          </Button>
        </>
      }
    >
      <TextField
        label="이전 회의 검색"
        placeholder="회의명으로 검색"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        leading={<Icon src={searchIcon} size={ICON_SIZE} className={styles.metaIcon} />}
      />

      <div className={styles.recent}>
        <h3 className={styles.subTitle}>최근 회의</h3>
        <ul className={styles.meetingList}>
          {previousMeetings === null && <li className={styles.caption}>불러오는 중이에요</li>}
          {previousMeetings?.length === 0 && <li className={styles.caption}>이 폴더에 지난 회의가 없어요</li>}
          {Boolean(previousMeetings?.length) && meetings.length === 0 && (
            <li className={styles.caption}>검색 결과가 없어요</li>
          )}
          {meetings.map((meeting) => (
            <li key={meeting.meetingId}>
              <button
                type="button"
                aria-pressed={meeting.meetingId === selectedId}
                className={[styles.meeting, meeting.meetingId === selectedId ? styles.meetingSelected : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedId(meeting.meetingId)}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.meetingInfo}>
                  <span className={styles.meetingTitle}>{meeting.title}</span>
                  <span className={styles.meetingDate}>{meeting.date}</span>
                  <span className={styles.meetingMeta}>
                    <span className={styles.metaItem}>
                      <Icon src={groupIcon} size={META_ICON_SIZE} className={styles.metaIcon} />
                      {meeting.attendees.length}명
                    </span>
                    {meeting.location && (
                      <span className={styles.metaItem}>
                        <Icon src={locationIcon} size={META_ICON_SIZE} className={styles.metaIcon} />
                        {meeting.location}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <fieldset className={styles.options}>
        <legend className={styles.optionsHead}>
          <span className={styles.subTitle}>불러올 항목</span>
          <span className={styles.caption}>필요한 설정만 고를 수 있어요</span>
        </legend>
        {SETTING_OPTIONS.map(({ key, label }) => (
          <Checkbox key={key} checked={keys.includes(key)} onChange={(event) => toggleKey(key, event.target.checked)}>
            {label}
          </Checkbox>
        ))}
      </fieldset>

      <p className={styles.note}>
        <Icon src={infoIcon} size={ICON_SIZE} />
        회의 날짜와 시간, 안건, 사전 자료는 불러오지 않아요
      </p>
    </Dialog>
  );
}
