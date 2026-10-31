// 공통 UI 조각: 화면 틀·헤더·버튼·행·바텀시트·칩. 색·간격은 design-tokens.css만 쓴다.
import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { isInToss } from '../platform/toss';
import { Icon, type IconName } from './Icon';

/**
 * 화면 헤더. 토스 안에서는 토스 내비게이션 바의 뒤로가기를 쓰므로 자체 뒤로가기를 그리지 않는다(D-005).
 * leading='close'는 온보딩 '결과 공유하기'처럼 닫기(X) 모양.
 */
export function Header({ title, right, leading = 'back', onBack }: { title?: ReactNode; right?: ReactNode; leading?: 'back' | 'close' | 'none'; onBack?: () => void }) {
  const navigate = useNavigate();
  const showLeading = leading !== 'none' && (!isInToss() || leading === 'close');
  return (
    <header className="header">
      {showLeading && (
        <button type="button" className="header__icon" onClick={onBack ?? (() => navigate(-1))} aria-label={leading === 'close' ? '닫기' : '뒤로'}>
          <Icon name={leading === 'close' ? 'close' : 'back'} />
        </button>
      )}
      {title && <h1 className="header__title">{title}</h1>}
      <div className="header__right">{right}</div>
    </header>
  );
}

export function Screen({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={`screen ${className ?? ''}`}>
      <main className="screen__body">{children}</main>
      {footer && <div className="screen__footer">{footer}</div>}
    </div>
  );
}

export function Button({
  children, onClick, variant = 'primary', icon, disabled, type = 'button', small,
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'outline' | 'muted' | 'text'; icon?: IconName; disabled?: boolean; type?: 'button' | 'submit'; small?: boolean }) {
  return (
    <button type={type} className={`btn btn--${variant}${small ? ' btn--small' : ''}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

/** 온보딩 '내 조건 입력하기'의 한 줄: 동그란 아이콘 · 이름 · 오른쪽 값 · 화살표. */
export function Row({ icon, label, value, onClick, leading }: { icon?: IconName; label: ReactNode; value?: ReactNode; onClick?: () => void; leading?: ReactNode }) {
  const body = (
    <>
      {leading ?? (icon && <span className="row__icon"><Icon name={icon} size={18} /></span>)}
      <span className="row__label">{label}</span>
      {value != null && <span className="row__value">{value}</span>}
      {onClick && <Icon name="chevron" size={16} className="row__chevron" />}
    </>
  );
  return onClick ? (
    <button type="button" className="row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="row">{body}</div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {right}
    </div>
  );
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`chip${selected ? ' chip--on' : ''}`} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

/** 바텀시트. 사용자가 누를 때만 연다(진입 즉시 바텀시트 금지 — 토스 체크리스트). */
export function Sheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="header__icon" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p className={`notice notice--${tone}`}>
      <Icon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}

export function Toast({ message }: { message: string | null }) {
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return <p className="loading">{label}</p>;
}
