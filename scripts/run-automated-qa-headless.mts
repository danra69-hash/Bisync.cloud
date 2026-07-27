/**
 * Headless Automated QA runner against a live/API base URL.
 *
 * Usage:
 *   cd client && VITE_API_URL=https://... npx --yes vite-node --config vite.config.ts ../scripts/run-automated-qa-headless.mts
 *
 * Optional:
 *   DEV_CONSOLE_EMAIL / DEV_CONSOLE_PASSWORD — Dev Console session for history + purge
 *   QA_PURGE_FIRST=1 — purge leftover QA Power companies before the run
 *   QA_START_FROM=<stepId> — resume from a step id
 */
const API_BASE = (process.env.VITE_API_URL ?? '').replace(/\/$/, '');
if (!API_BASE) {
  console.error('VITE_API_URL is required (e.g. https://bisync-cloud-....run.app)');
  process.exit(2);
}

// Minimal browser globals for client modules that touch localStorage / window.
const store = new Map<string, string>();
const localStoragePolyfill = {
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  setItem(key: string, value: string) {
    store.set(key, String(value));
  },
  removeItem(key: string) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
  get length() {
    return store.size;
  },
};

(globalThis as { localStorage?: typeof localStoragePolyfill }).localStorage = localStoragePolyfill;
(globalThis as { window?: { localStorage: typeof localStoragePolyfill } }).window = {
  localStorage: localStoragePolyfill,
};

async function loginDevConsole(): Promise<string | null> {
  const email = process.env.DEV_CONSOLE_EMAIL ?? 'dra@cubevalue.com';
  const password = process.env.DEV_CONSOLE_PASSWORD ?? 'Pass@123';
  const passwordRes = await fetch(`${API_BASE}/api/dev-console/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!passwordRes.ok) {
    console.warn(`Dev Console password login failed: ${passwordRes.status}`);
    return null;
  }
  const ticket = (await passwordRes.json()) as {
    passwordTicket: string;
    allowPasswordOnly?: boolean;
  };
  if (!ticket.allowPasswordOnly) {
    console.warn('Dev Console requires Google — continuing without session token');
    return null;
  }
  const sessionRes = await fetch(`${API_BASE}/api/dev-console/auth/password-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordTicket: ticket.passwordTicket }),
  });
  if (!sessionRes.ok) {
    console.warn(`Dev Console password-only failed: ${sessionRes.status}`);
    return null;
  }
  const session = (await sessionRes.json()) as { token: string };
  localStoragePolyfill.setItem('bisync.devConsoleToken', session.token);
  return session.token;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  const token = await loginDevConsole();
  console.log(token ? 'Dev Console session: ok' : 'Dev Console session: skipped');

  // Dynamic import after polyfills so api.ts sees localStorage.
  const { runAutomatedQa, getPowerQaTaskDefs } = await import('../client/src/data/devQaRunner.ts');
  const { purgeQaOperationalData, devConsoleApi } = await import('../client/src/data/devConsoleApi.ts');

  const defs = getPowerQaTaskDefs();
  console.log(`Suite: ${defs.length} steps`);

  if (process.env.QA_PURGE_FIRST === '1') {
    console.log('Purging leftover QA Power companies…');
    try {
      const purged = await purgeQaOperationalData({ purgeAllQaPower: true });
      console.log(
        `Purge done · companies ${purged.companiesDeleted} · note: ${purged.note ?? 'n/a'}`,
      );
    } catch (err) {
      console.warn('Purge failed (continuing):', err instanceof Error ? err.message : err);
    }
  }

  let historyId: number | null = null;
  try {
    const started = await devConsoleApi.startQaRun({
      triggeredBy: 'headless-agent',
      status: 'running',
      summary: 'Headless Automated QA started',
    });
    historyId = started.id;
    console.log(`QA history row #${historyId}`);
  } catch (err) {
    console.warn('Could not create QA history row:', err instanceof Error ? err.message : err);
  }

  const startFrom = process.env.QA_START_FROM?.trim() || undefined;
  let lastPrinted = '';
  const result = await runAutomatedQa('headless-agent', tasks => {
    const running = tasks.find(t => t.status === 'running');
    const line = running
      ? `[${tasks.filter(t => t.status === 'pass' || t.status === 'warn').length + 1}/${tasks.length}] ${running.id} — ${running.label}`
      : null;
    if (line && line !== lastPrinted) {
      lastPrinted = line;
      console.log(line);
    }
  }, startFrom ? { startFromId: startFrom } : undefined);

  for (const t of result.tasks) {
    if (t.status === 'pending') continue;
    const mark =
      t.status === 'pass' ? 'PASS' : t.status === 'warn' ? 'WARN' : t.status === 'fail' ? 'FAIL' : t.status;
    console.log(
      `${mark.padEnd(4)} ${t.id.padEnd(36)} ${(t.durationMs ?? 0).toString().padStart(6)}ms  ${t.detail ?? ''}`,
    );
  }

  console.log('\n' + result.summary);
  console.log(
    `Context: company=${result.context.companyName ?? 'n/a'} (#${result.context.companyId ?? 'n/a'}) runKey=${result.context.runKey}`,
  );

  if (historyId != null) {
    try {
      await devConsoleApi.completeQaRun(historyId, {
        status: result.status === 'passed' ? 'passed' : result.status === 'warning' ? 'warning' : 'failed',
        summary: result.summary,
        resultsJson: JSON.stringify({
          version: 2,
          sealedAt: new Date().toISOString(),
          source: 'headless',
          tasks: result.tasks,
          context: {
            runKey: result.context.runKey,
            companyId: result.context.companyId,
            companyName: result.context.companyName,
            ownerUserId: result.context.ownerUserId,
          },
        }),
      });
      console.log(`QA history #${historyId} updated`);
    } catch (err) {
      console.warn('Could not update QA history:', err instanceof Error ? err.message : err);
    }
  }

  // Soft-warn-only runs are acceptable (deferred features). Hard fails are not.
  const hardFail = result.tasks.some(t => t.status === 'fail');
  process.exit(hardFail ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
