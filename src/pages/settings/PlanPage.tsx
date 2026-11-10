import checkIcon from '../../assets/icons/check-sm.svg';
import Icon from '../../components/Icon';
import SettingsLayout from './SettingsLayout';
import styles from './PlanPage.module.css';

const CHECK_ICON_SIZE = 16;
const BETA_FEATURES = ['회의 무제한', '회의록 AI 요약', '워크스페이스 무제한', '멤버 무제한'];

/** REQ-176 요금제 안내 (디자인 PlanPage, MSG-074). 결제, 업그레이드, 사용량 한도는 없다 (베타 기간 모두 무료) */
export default function PlanPage() {
  return (
    <SettingsLayout title="요금제" description="지금은 베타 기간이라 모든 기능을 무료로 쓸 수 있어요">
      <div className={styles.plans}>
        <section className={`${styles.plan} ${styles.current}`} aria-labelledby="plan-beta-title">
          <div className={styles.planHead}>
            <h3 id="plan-beta-title" className={styles.planName}>
              Beta
            </h3>
            <span className={styles.badge}>이용 중</span>
          </div>
          <p className={styles.price}>0원</p>
          <p className={styles.caption}>베타 기간에는 모든 기능을 제한 없이 써요</p>
          <ul className={styles.features}>
            {BETA_FEATURES.map((feature) => (
              <li key={feature} className={styles.feature}>
                <Icon src={checkIcon} size={CHECK_ICON_SIZE} className={styles.check} />
                {feature}
              </li>
            ))}
          </ul>
          <button type="button" className={styles.currentButton} disabled>
            현재 요금제
          </button>
        </section>
        <section className={`${styles.plan} ${styles.upcoming}`} aria-labelledby="plan-paid-title">
          <span className={styles.upcomingBadge}>추후 예정</span>
          <h3 id="plan-paid-title" className={styles.upcomingTitle}>
            유료 요금제는 준비 중이에요
          </h3>
          <p className={styles.caption}>
            정식 출시 전에 요금제와 혜택을 이메일로 미리 알려 드릴게요.
            <br />
            베타 기간에 만든 워크스페이스와 회의록은 그대로 남아요.
          </p>
        </section>
      </div>
      <p className={styles.footnote}>베타 기간이 끝나도 자동으로 결제되지 않아요</p>
    </SettingsLayout>
  );
}
