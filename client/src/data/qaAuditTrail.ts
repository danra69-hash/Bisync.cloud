import type { PowerQaContext, QaRunResult, QaTaskResult } from './devQaRunner';

/** Durable Audit History envelope stored in DevQaRuns.ResultsJson (v2). */
export type QaAuditEnvelope = {
  version: 2;
  sealedAt: string;
  /** Operational QA rows still in DB vs purged after user confirmed no issues. */
  dataLifecycle: 'active' | 'disappeared';
  confirmedNoIssuesAt?: string;
  disposedAt?: string;
  context: QaAuditContext;
  artifactCounts: {
    components: number;
    purchaseOrders: number;
    hasSubProduct: boolean;
    hasFinishedProduct: boolean;
    hasCashPurchase: boolean;
  };
  tasks: QaTaskResult[];
};

export type QaAuditContext = {
  runKey: string;
  ownerUserId?: number;
  ownerEmail?: string;
  ownerName?: string;
  companyId?: number;
  companyName?: string;
  restaurantLocationId?: number;
  restaurantExternalId?: string;
  kitchenLocationId?: number;
  kitchenExternalId?: string;
  employeeId?: number;
  adminUserId?: number;
  adminEmail?: string;
  adminName?: string;
  hrStaffEmployeeId?: number;
  hrStaffEmail?: string;
  hrStaffName?: string;
  provisionedDatabaseName?: string;
  cogsAuditHistoryRunId?: string;
  components: PowerQaContext['components'];
  subProduct?: PowerQaContext['subProduct'];
  finishedProduct?: PowerQaContext['finishedProduct'];
  purchaseOrders: PowerQaContext['purchaseOrders'];
  cashPurchaseComponentId?: string;
};

export function sanitizeQaContext(ctx: PowerQaContext): QaAuditContext {
  return {
    runKey: ctx.runKey,
    ownerUserId: ctx.ownerUserId,
    ownerEmail: ctx.ownerEmail,
    ownerName: ctx.ownerName,
    companyId: ctx.companyId,
    companyName: ctx.companyName,
    restaurantLocationId: ctx.restaurantLocationId,
    restaurantExternalId: ctx.restaurantExternalId,
    kitchenLocationId: ctx.kitchenLocationId,
    kitchenExternalId: ctx.kitchenExternalId,
    employeeId: ctx.employeeId,
    adminUserId: ctx.adminUserId,
    adminEmail: ctx.adminEmail,
    adminName: ctx.adminName,
    hrStaffEmployeeId: ctx.hrStaffEmployeeId,
    hrStaffEmail: ctx.hrStaffEmail,
    hrStaffName: ctx.hrStaffName,
    provisionedDatabaseName: ctx.provisionedDatabaseName,
    cogsAuditHistoryRunId: ctx.cogsAuditHistoryRunId,
    components: ctx.components,
    subProduct: ctx.subProduct,
    finishedProduct: ctx.finishedProduct,
    purchaseOrders: ctx.purchaseOrders,
    cashPurchaseComponentId: ctx.cashPurchaseComponentId,
  };
}

export function sealQaAudit(result: QaRunResult, sealedAt = new Date().toISOString()): QaAuditEnvelope {
  return {
    version: 2,
    sealedAt,
    dataLifecycle: 'active',
    context: sanitizeQaContext(result.context),
    artifactCounts: {
      components: result.context.components.length,
      purchaseOrders: result.context.purchaseOrders.length,
      hasSubProduct: !!result.context.subProduct,
      hasFinishedProduct: !!result.context.finishedProduct,
      hasCashPurchase: !!result.context.cashPurchaseComponentId,
    },
    tasks: result.tasks,
  };
}

export function markQaDataDisappeared(
  envelope: QaAuditEnvelope,
  at = new Date().toISOString(),
): QaAuditEnvelope {
  return {
    ...envelope,
    dataLifecycle: 'disappeared',
    confirmedNoIssuesAt: envelope.confirmedNoIssuesAt ?? at,
    disposedAt: at,
  };
}

export function serializeQaAudit(envelope: QaAuditEnvelope): string {
  return JSON.stringify(envelope);
}

export function parseQaAuditPayload(resultsJson: string): {
  tasks: QaTaskResult[];
  audit: QaAuditEnvelope | null;
} {
  try {
    const parsed = JSON.parse(resultsJson) as unknown;
    if (Array.isArray(parsed)) {
      return { tasks: filterTasks(parsed), audit: null };
    }
    if (
      parsed
      && typeof parsed === 'object'
      && Array.isArray((parsed as QaAuditEnvelope).tasks)
      && (parsed as QaAuditEnvelope).version === 2
    ) {
      const envelope = parsed as QaAuditEnvelope;
      return { tasks: filterTasks(envelope.tasks), audit: envelope };
    }
    return { tasks: [], audit: null };
  } catch {
    return { tasks: [], audit: null };
  }
}

function filterTasks(raw: unknown[]): QaTaskResult[] {
  return raw.filter((t): t is QaTaskResult =>
    !!t
    && typeof t === 'object'
    && typeof (t as QaTaskResult).id === 'string'
    && typeof (t as QaTaskResult).status === 'string',
  );
}
