import { request } from './client';

// REQ-185, 186 회의 중 챗봇 (meeting-service, docs/services/rag-chatbot.md 4장)

export type ChatBasis = 'sources' | 'general' | 'mixed';

export interface ChatCitation {
  /** 답 속 [n] 번호 */
  ref: number;
  /** minutes(지난 회의록) / upload(사전 자료) / live(진행 중 회의) */
  sourceType: 'minutes' | 'upload' | 'live';
  docId: number | null;
  title: string;
  text: string;
  /** label은 화면에 그대로 보여 주는 위치 글 (예: "결정 사항", "3쪽") */
  location: { type: string; label: string };
}

export interface ChatMessage {
  messageId: number;
  role: 'USER' | 'ASSISTANT';
  /** 답에는 [n], [일반] 표시가 그대로 들어 있다 */
  text: string;
  status: 'answered' | 'no_result' | null;
  basis: ChatBasis | null;
  citations: ChatCitation[];
  createdAt: string;
}

export interface ChatAnswer {
  status: 'answered' | 'no_result' | 'failed';
  errorCode: string | null;
  /** failed면 저장하지 않아 null */
  question: ChatMessage | null;
  answer: ChatMessage | null;
}

/** 내 대화 (오래된 것부터, 다른 참석자에게 보이지 않는다) */
export function getChat(meetingId: number) {
  return request<ChatMessage[]>('GET', `/api/meetings/${meetingId}/chat`);
}

/** 질문 하나. 답이 나올 때까지 최대 60초 걸린다 */
export function askChat(meetingId: number, query: string) {
  return request<ChatAnswer>('POST', `/api/meetings/${meetingId}/chat`, { query });
}
