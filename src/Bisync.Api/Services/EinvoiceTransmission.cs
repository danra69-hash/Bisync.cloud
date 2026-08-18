using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Services;

public sealed record EinvoiceSubmitRequest(
    int CompanyId,
    string DocumentType,
    string SourceDocKey,
    int? OpenItemId,
    int? JournalId,
    object Payload);

public sealed record EinvoiceSubmitResult(
    string Status,
    string? ExternalUin,
    string? ProviderRef,
    string? Error);

/// <summary>
/// Phase D e-invoice aggregator port (MyInvois / Peppol). Real adapters (Storecove/Fonoa-class)
/// plug in behind this interface; posting never calls LHDN directly.
/// </summary>
public interface IEInvoiceTransmissionPort
{
    string ProviderId { get; }
    Task<EinvoiceSubmitResult> SubmitAsync(EinvoiceSubmitRequest request, CancellationToken ct = default);
    Task<EinvoiceSubmitResult> GetStatusAsync(string externalRef, CancellationToken ct = default);
}

/// <summary>Dev / CI stub — queues a local transmission row and fabricates a UIN.</summary>
public sealed class StubMyInvoisTransmissionPort(
    BisyncDbContext db,
    ILogger<StubMyInvoisTransmissionPort> logger) : IEInvoiceTransmissionPort
{
    public string ProviderId => "myinvois-stub";

    public async Task<EinvoiceSubmitResult> SubmitAsync(EinvoiceSubmitRequest request, CancellationToken ct = default)
    {
        await SchemaPatcher.EnsureGlBooksTablesAsync(db);
        var uin = $"STUB-{request.CompanyId}-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";
        var row = new GlEinvoiceTransmission
        {
            CompanyId = request.CompanyId,
            Provider = ProviderId,
            DocumentType = request.DocumentType,
            SourceDocKey = request.SourceDocKey,
            OpenItemId = request.OpenItemId,
            JournalId = request.JournalId,
            Status = "accepted",
            ExternalUin = uin,
            PayloadJson = JsonSerializer.Serialize(request.Payload),
            CreatedAt = DateTime.UtcNow,
            SubmittedAt = DateTime.UtcNow,
        };
        db.GlEinvoiceTransmissions.Add(row);

        if (request.OpenItemId is > 0)
        {
            var item = await db.GlOpenItems.FirstOrDefaultAsync(
                i => i.Id == request.OpenItemId && i.CompanyId == request.CompanyId, ct);
            if (item is not null)
                item.StatutoryDocumentNo = uin;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Stub MyInvois accepted {Uin} for company {CompanyId} doc {Doc}",
            uin, request.CompanyId, request.SourceDocKey);
        return new EinvoiceSubmitResult("accepted", uin, row.Id.ToString(), null);
    }

    public Task<EinvoiceSubmitResult> GetStatusAsync(string externalRef, CancellationToken ct = default)
        => Task.FromResult(new EinvoiceSubmitResult("accepted", externalRef, externalRef, null));
}

/// <summary>Queues AR invoices / AP self-billed docs through the e-invoice port.</summary>
public sealed class EinvoiceDispatchService(
    BisyncDbContext db,
    IEInvoiceTransmissionPort port,
    ILogger<EinvoiceDispatchService> logger)
{
    public async Task<object?> QueueOpenItemAsync(int companyId, int openItemId, CancellationToken ct = default)
    {
        var item = await db.GlOpenItems.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == openItemId && i.CompanyId == companyId, ct);
        if (item is null) return null;
        if (item.Kind is not ("invoice" or "credit_note" or "bill"))
            return new { skipped = true, reason = "Document kind not e-invoice eligible." };

        try
        {
            var result = await port.SubmitAsync(new EinvoiceSubmitRequest(
                companyId,
                item.Kind,
                item.InternalDocumentNo,
                item.Id,
                item.JournalId,
                new
                {
                    item.InternalDocumentNo,
                    item.CounterpartyName,
                    item.CounterpartyRef,
                    item.Currency,
                    gross = LedgerPostingService.FromMinor(item.GrossMinor, item.Currency),
                    tax = LedgerPostingService.FromMinor(item.TaxMinor, item.Currency),
                    item.TaxCode,
                    item.IssueDate,
                    provider = port.ProviderId,
                }), ct);
            return new
            {
                openItemId = item.Id,
                result.Status,
                result.ExternalUin,
                provider = port.ProviderId,
                note = port.ProviderId == "myinvois-stub"
                    ? "Stub accepted — replace IEInvoiceTransmissionPort with intermediary adapter for production MyInvois."
                    : null,
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "E-invoice dispatch failed for open item {Id}", openItemId);
            return new { openItemId, status = "error", error = ex.Message };
        }
    }
}
