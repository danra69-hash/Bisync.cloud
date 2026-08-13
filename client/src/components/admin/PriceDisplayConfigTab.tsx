import { useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { usePriceDisplaySettings } from '../../context/PriceDisplaySettingsContext';
import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAIL } from '../../data/platformOwner';
import { useAppTranslation } from '../../i18n/useAppTranslation';

const MIN = 0;
const MAX = 6;

function clampInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX, Math.max(MIN, n));
}

export function PriceDisplayConfigTab() {
  const { t } = useAppTranslation();
  const { currentUser } = useCurrentUser();
  const { settings, loading, save, refresh } = usePriceDisplaySettings();
  const canEdit = isPlatformOwnerEmail(currentUser?.email) || Boolean(settings?.canEdit);

  const defaults = settings?.defaults ?? {
    principalUomPriceDecimals: 4,
    alternateUomPriceDecimals: 2,
    vendorDeliveryPriceDecimals: 2,
  };

  const [principal, setPrincipal] = useState(String(defaults.principalUomPriceDecimals));
  const [alternate, setAlternate] = useState(String(defaults.alternateUomPriceDecimals));
  const [delivery, setDelivery] = useState(String(defaults.vendorDeliveryPriceDecimals));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setPrincipal(String(settings.principalUomPriceDecimals));
    setAlternate(String(settings.alternateUomPriceDecimals));
    setDelivery(String(settings.vendorDeliveryPriceDecimals));
  }, [settings]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    return (
      clampInt(principal, settings.principalUomPriceDecimals) !== settings.principalUomPriceDecimals
      || clampInt(alternate, settings.alternateUomPriceDecimals) !== settings.alternateUomPriceDecimals
      || clampInt(delivery, settings.vendorDeliveryPriceDecimals) !== settings.vendorDeliveryPriceDecimals
    );
  }, [settings, principal, alternate, delivery]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await save({
        principalUomPriceDecimals: clampInt(principal, defaults.principalUomPriceDecimals),
        alternateUomPriceDecimals: clampInt(alternate, defaults.alternateUomPriceDecimals),
        vendorDeliveryPriceDecimals: clampInt(delivery, defaults.vendorDeliveryPriceDecimals),
      });
      setSavedMsg(t('systemConfig.priceDisplaySaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('systemConfig.priceDisplaySaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    setPrincipal(String(defaults.principalUomPriceDecimals));
    setAlternate(String(defaults.alternateUomPriceDecimals));
    setDelivery(String(defaults.vendorDeliveryPriceDecimals));
    setSavedMsg(null);
    setError(null);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t('systemConfig.priceDisplayHeading')}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t('systemConfig.priceDisplayBody')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('systemConfig.priceDisplayDefaultsNote')}
        </p>
      </div>

      {loading && !settings ? (
        <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-3 border border-border/70 rounded-md p-4 bg-muted/20">
          <Field
            label={t('systemConfig.principalUomDecimals')}
            value={principal}
            onChange={setPrincipal}
            disabled={!canEdit || saving}
          />
          <Field
            label={t('systemConfig.alternateUomDecimals')}
            value={alternate}
            onChange={setAlternate}
            disabled={!canEdit || saving}
          />
          <Field
            label={t('systemConfig.vendorDeliveryDecimals')}
            value={delivery}
            onChange={setDelivery}
            disabled={!canEdit || saving}
          />

          {!canEdit && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t('systemConfig.priceDisplayOwnerOnly', { email: PLATFORM_OWNER_EMAIL })}
            </p>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {savedMsg && <p className="text-xs text-primary">{savedMsg}</p>}

          {settings?.updatedByEmail ? (
            <p className="text-[11px] text-muted-foreground font-sans">
              {t('systemConfig.priceDisplayLastUpdated', {
                email: settings.updatedByEmail,
                at: settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : '—',
              })}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canEdit || saving || !dirty}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={handleResetDefaults}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/60 disabled:opacity-50"
            >
              {t('systemConfig.priceDisplayResetDefaults')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { void refresh(); }}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-muted/60 disabled:opacity-50"
            >
              {t('common.refresh')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={MIN}
        max={MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="h-9 px-3 rounded-md border border-border bg-background text-sm tabular-nums disabled:opacity-60"
      />
    </label>
  );
}
