import { FileText } from 'lucide-react';
import { pageShellClass } from '../layout/pageLayout';

export function ModuleContent({ label }: { section: string; label: string }) {
  return (
    <div className={pageShellClass()}>
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-2 p-6">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground font-sans max-w-xs">This module is ready to be configured.</p>
      </div>
    </div>
  );
}
