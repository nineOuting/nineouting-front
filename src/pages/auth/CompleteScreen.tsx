import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import successIcon from '../../assets/icons/success.svg';
import Icon from '../../components/Icon';
import auth from './auth.module.css';
import styles from './CompleteScreen.module.css';

const ICON_SIZE = 32;

interface CompleteScreenProps {
  title: string;
  message: string;
}

/** 회원가입 완료·비밀번호 변경 완료. "로그인하기" 클릭 시 로그인 화면으로 이동 */
export default function CompleteScreen({ title, message }: CompleteScreenProps) {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <section className={`${auth.card} ${styles.card}`} aria-labelledby="complete-title">
        <span className={styles.iconCircle}>
          <Icon src={successIcon} size={ICON_SIZE} />
        </span>
        <div className={`${auth.titleGroup} ${styles.texts}`}>
          <h1 id="complete-title" className={auth.displayTitle}>
            {title}
          </h1>
          <p className={auth.subtitle}>{message}</p>
        </div>
        <Button onClick={() => navigate('/login')}>로그인하기</Button>
      </section>
    </AuthLayout>
  );
}
