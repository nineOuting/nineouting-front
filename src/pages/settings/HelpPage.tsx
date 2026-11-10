import { useState } from 'react';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import searchIcon from '../../assets/icons/search.svg';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import layout from './SettingsLayout.module.css';
import SettingsLayout from './SettingsLayout';
import styles from './HelpPage.module.css';

const ICON_SIZE = 20;

// 지금 화면에서 할 수 있는 일만 적는다. 기능이 바뀌면 함께 고친다
const FAQ = [
  {
    question: '회의록은 어디에서 볼 수 있나요?',
    answer: '왼쪽 메뉴의 회의록 아카이브에서 지난 회의록을 모두 볼 수 있어요. 기간, 장소로 거르거나 회의명, 내용으로 검색할 수 있어요.',
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
    question: '지운 폴더는 되살릴 수 있나요?',
    answer: '지운 폴더와 그 안의 회의록은 쓰레기통(설정 > 삭제 목록)으로 옮겨져요. 3개월 안에는 다시 살릴 수 있어요.',
  },
  {
    question: '회의록 양식은 어떻게 만드나요?',
    answer: '왼쪽 메뉴의 회의록 양식에서 새 양식을 만들고 섹션, 표, 레이아웃을 정할 수 있어요. 회의 대기실에서 양식을 골라 회의록을 만들어요.',
  },
];

/** REQ-144 도움말: 자주 묻는 질문 (디자인 HelpPage). 문의하기는 받을 곳이 없어 넣지 않았다 */
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
        {shown.length === 0 && <p className={styles.empty}>검색 결과가 없어요</p>}
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
