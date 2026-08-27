// Self-test fixture — synthetic source. NOT real code. Line numbers are load-bearing:
// the good inventory cites #L88 (approval-limit rule) and #L60 (a gap). Keep this file > 88 lines.
using System;

namespace Fixture.Services
{
    public class ApprovalService
    {
        private readonly IInvoiceRepository _invoices;
        private readonly IUserContext _user;

        public ApprovalService(IInvoiceRepository invoices, IUserContext user)
        {
            _invoices = invoices;
            _user = user;
        }

        // Approve an invoice. Enforces the manager approval limit.
        public ApprovalResult Approve(int invoiceId)
        {
            var invoice = _invoices.Get(invoiceId);
            if (invoice == null)
            {
                return ApprovalResult.NotFound();
            }

            if (invoice.Status == InvoiceStatus.Approved)
            {
                return ApprovalResult.AlreadyApproved();
            }

            if (!_user.IsAuthenticated)
            {
                return ApprovalResult.Unauthorized();
            }

            // Basic role check before amount evaluation.
            if (!_user.HasRole("approver"))
            {
                return ApprovalResult.Forbidden("Approver role required");
            }

            return EvaluateLimit(invoice);
        }

        // Amount-based branch. The magic threshold here is intentionally undocumented — the good
        // inventory logs it as a GAP anchored to this method.
        private ApprovalResult EvaluateLimit(Invoice invoice)
        {
            var threshold = LookupThreshold();

            if (invoice.Total <= threshold)
            {
                invoice.Status = InvoiceStatus.Approved;
                _invoices.Save(invoice);
                return ApprovalResult.Approved();
            }

            // Line ~60: configuration-driven threshold whose basis is unclear from code alone (GAP).
            return EscalateOrReject(invoice);
        }

        private int LookupThreshold()
        {
            // Value comes from runtime config; static reading cannot resolve the effective number.
            return _invoices.ConfiguredApprovalLimit;
        }

        private ApprovalResult EscalateOrReject(Invoice invoice)
        {
            var isManager = _user.HasRole("manager");
            if (isManager && invoice.Total <= 10000)
            {
                invoice.Status = InvoiceStatus.Approved;
                _invoices.Save(invoice);
                return ApprovalResult.Approved();
            }

            // Over-limit and not permitted: the manager approval-limit rule.
            // Line ~88: respond 403 "Approval limit exceeded" — no state change.
            return ApprovalResult.Forbidden("Approval limit exceeded");
        }

        public bool CanApprove(int invoiceId)
        {
            var invoice = _invoices.Get(invoiceId);
            return invoice != null && invoice.Status == InvoiceStatus.Pending;
        }
    }
}
