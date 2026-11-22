import { useState } from 'react';
import unknownCharacter from '../../assets/characters/unknown.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import searchIcon from '../../assets/icons/search.svg';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import layout from './SettingsLayout.module.css';
import SettingsLayout from './SettingsLayout';
import styles from './HelpPage.module.css';

const ICON_SIZE = 20;

// 지금 화면에서 할 수 있는 일만 적는다. 기능이 바뀌면 함께 고친다
// 피그마 프론트 Help_Modal의 질문 5개. 새로 생긴 두 답은 피그마 다른 화면 문구를 따랐다 (녹음, 전사 동의 창과 요금제)
const FAQ = [
  {
    question: '회의록은 어디에서 볼 수 있나요?',
    answer: '왼쪽 메뉴의 회의록 아카이브에서 지난 회의록을 모두 볼 수 있어요. 회의명이나 내용으로 검색할 수 있어요.',
  },
  {
    question: '녹음 파일은 얼마나 보관되나요?',
    answer: '녹음 원본은 30일 뒤 자동으로 삭제돼요.',
  },
  {
    question: '회의 중에 안건을 추가할 수 있나요?',
    answer: '네. 회의 중 화면의 안건 목록에서 안건을 추가할 수 있어요.',
  },
  {
    question: '멤버를 초대하려면 어떻게 하나요?',
    answer: '워크스페이스 화면의 [멤버 권한 관리]에서 이메일로 초대하거나, 초대 링크를 복사해 보낼 수 있어요. 초대 링크는 1일 동안 쓸 수 있어요.',
  },
  {
    question: '유료 요금제는 언제 나오나요?',
    answer: '정식 출시 전에 요금제와 혜택을 이메일로 미리 알려 드릴게요. 베타 기간에 만든 워크스페이스와 회의록은 그대로 남아요.',
  },
];

/** REQ-144 도움말: 자주 묻는 질문 (디자인 HelpPage). 문의하기는 디자인에서 빠졌다 (2026-11-18 디자인 코멘트) */
export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const keyword = query.trim();
  const shown = FAQ.filter(({ question, answer }) => !keyword || question.includes(keyword) || answer.includes(keyword));

  return (
    <SettingsLayout title="도움말" description="자주 묻는 질문을 모았어요">
      <TextField
        type="search"
        aria-label="도움말 검색"
        placeholder="궁금한 내용을 검색해 보세요"
        leading={<Icon src={searchIcon} size={ICON_SIZE} className={styles.searchIcon} />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={`${layout.card} ${styles.faqCard}`}>
        {/* MSG-123. 문의하기는 디자인에서 빠져 안내도 검색만 권한다 */}
        {shown.length === 0 && <EmptyState character={unknownCharacter} title="찾는 답이 없어요" description="다른 말로 다시 검색해 주세요." />}
        {shown.map((item, index) => {
          const isOpen = keyword ? true : openIndex === index;
          return (
            <div key={item.question} className={styles.item}>
              <button
                type="button"
                className={styles.question}
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span className={styles.q}>Q</span>
                <span className={styles.questionText}>{item.question}</span>
                <Icon src={chevronDownIcon} size={ICON_SIZE} className={isOpen ? styles.flipped : styles.chevron} />
              </button>
              {isOpen && <p className={styles.answer}>{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </SettingsLayout>
  );
}
