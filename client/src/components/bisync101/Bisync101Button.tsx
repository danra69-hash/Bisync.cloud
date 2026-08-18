import { BookOpen } from 'lucide-react';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  onClick: () => void;
};

export function Bisync101Button({ onClick }: Props) {
  const { t } = useAppTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 sm:px-2.5 text-[11px] font-bold tracking-wide transition-colors hover:bg-white/15"
      style={{ background: 'rgba(243,112,33,0.2)', color: '#F37021', border: '1px solid rgba(243,112,33,0.45)' }}
      title={t('bisync101.title')}
      aria-label={t('bisync101.title')}
    >
      <BookOpen size={13} className="shrink-0" />
      <span>Bisync101</span>
    </button>
  );
}
