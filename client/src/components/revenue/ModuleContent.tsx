import { FileText } from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';
import { useAppTranslation } from '../../i18n/useAppTranslation';

export function ModuleContent({ label }: { section: string; label: string }) {
  const { t, ui } = useAppTranslation();

  return (
    <div className={pageShellClass()}>
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-2 p-6">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{ui(label)}</p>
        <p className="text-xs text-muted-foreground font-sans max-w-xs">{t('common.moduleReady')}</p>
      </div>
    </div>
  );
}
