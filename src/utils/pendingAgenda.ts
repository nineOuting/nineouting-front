import type { Agenda, PendingAgenda } from '../types/meeting';

/** 이 회의에서 불러올 수 있는 남은 안건. 다른 회의가 이미 불러간 것은 뺀다 (REQ-052) */
export function pendingAgendasFor(pendingAgendas: PendingAgenda[], meetingId?: number) {
  return pendingAgendas.filter(({ takenMeetingId }) => takenMeetingId === undefined || takenMeetingId === meetingId);
}

/** 저장된 안건에는 넘긴 날짜가 없어 남은 안건 목록에서 찾아 붙인다 (REQ-051) */
export function withCarriedOverDates(agendas: Agenda[], pendingAgendas: PendingAgenda[]) {
  return agendas.map((agenda) => ({
    ...agenda,
    carriedOverFrom: pendingAgendas.find(({ id }) => id === agenda.pendingAgendaId)?.carriedOverFrom,
  }));
}
