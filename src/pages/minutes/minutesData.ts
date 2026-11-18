import { changeMinutesTemplate, getMinutesByMeeting, listMinutesTemplates } from '../../api/minutes';
import { getMe } from '../../api/user';
import { toTime } from '../../utils/calendar';
import { formatMeetingDate } from '../../utils/meetingFormat';

// 회의록 편집 화면(MinutesEditorPage)과 회의가 끝난 뒤의 회의록 확인 화면(MinutesCheck)이 함께 쓴다

/** 2026-10-29T14:00 ~ 15:00 → 2026. 10.29 (화) 14:00 - 15:00 (디자인 23:588) */
export function scheduleLabel(startAt: string, endAt?: string) {
  const [date, weekday] = formatMeetingDate(startAt.slice(0, 10)).split('(');
  const [year, ...rest] = date.split('.');
  const range = endAt ? `${toTime(startAt)} - ${toTime(endAt)}` : toTime(startAt);
  return `${year}. ${rest.join('.')} (${weekday} ${range}`;
}

/** 회의록·나·양식을 받는다. 처음 여는 작성자에게는 기본 양식으로 칸을 만들어 준다 (그러면 서버가 AI 초안을 요청한다, REQ-101) */
export async function fetchMinutes(meetingId: number) {
  const [detail, me, templateList] = await Promise.all([getMinutesByMeeting(meetingId), getMe(), listMinutesTemplates()]);
  const defaultTemplate = templateList.find((template) => template.isDefault);
  const needsTemplate =
    detail.writer.userId === me.userId &&
    detail.status === 'WRITING' &&
    detail.templateId === null &&
    detail.sections.length === 0;
  return {
    detail:
      needsTemplate && defaultTemplate ? await changeMinutesTemplate(detail.minutesId, defaultTemplate.templateId) : detail,
    myUserId: me.userId,
    templateList,
  };
}
