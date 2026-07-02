import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, FileStack, X } from 'lucide-react';
import { api, type OrderTemplate } from '../../api';
import {
  countAppliedTemplateItems,
  describeOrderTemplateSchedule,
  filterOrderTemplatesForToday,
  weekdayLabelForDate,
} from '../../data/orderTemplates';
import type { CreateOrderLine } from '../../data/createOrder';

type Props = {
  selectedCompanyId: number;
  selectedLocationIds: string[];
  lines: CreateOrderLine[];
  onClose: () => void;
  onApply: (template: OrderTemplate) => void;
};

export function OrderTemplatePickerModal({
  selectedCompanyId,
  selectedLocationIds,
  lines,
  onClose,
  onApply,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const today = useMemo(() => new Date(), []);
  const todayLabel = useMemo(
    () => today.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    [today],
  );

  useEffect(() => {
    setLoading(true);
    api.orderTemplates(selectedCompanyId)
      .then(rows => setTemplates(rows))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const matchingTemplates = useMemo(
    () => filterOrderTemplatesForToday(templates, selectedLocationIds, today),
    [templates, selectedLocationIds, today],
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileStack size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">PO Template</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Templates scheduled for today ({todayLabel})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto divide-y divide-border">
          {loading ? (
            <p className="px-5 py-8 text-xs text-muted-foreground text-center">Loading templates…</p>
          ) : matchingTemplates.length === 0 ? (
            <div className="px-5 py-10 text-center space-y-2">
              <CalendarDays size={24} className="mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">No templates for today</p>
              <p className="text-xs text-muted-foreground">
                Only templates matching {weekdayLabelForDate(today)} or day {today.getDate()} are shown.
              </p>
            </div>
          ) : (
            matchingTemplates.map(template => {
              const applicableCount = countAppliedTemplateItems(template, lines);
              return (
                <div key={template.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {template.vendorName || 'All vendors'} · {template.items.length} item{template.items.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Schedule: {describeOrderTemplateSchedule(template)}
                      {template.repeatEnabled ? ' · Repeat on' : ''}
                    </p>
                    {applicableCount < template.items.length && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                        {applicableCount} of {template.items.length} items match current filters.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={applicableCount === 0}
                    onClick={() => onApply(template)}
                    className="shrink-0 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
