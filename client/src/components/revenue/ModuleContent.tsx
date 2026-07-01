import { FileText } from 'lucide-react';

export function ModuleContent({ section, label }: { section: string; label: string }) {
  return (
    <div className="p-6">
      <p className="text-xs font-sans text-muted-foreground mb-1 uppercase tracking-widest">{section}</p>
      <h2 className="text-lg font-semibold text-foreground mb-5">{label}</h2>
      <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center text-center gap-3 p-12">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <FileText size={18} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground font-sans max-w-xs">This module is ready to be configured.</p>
      </div>
    </div>
  );
}
