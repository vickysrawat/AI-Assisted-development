using System.Configuration;
using PurchaseOrders.Api.Models;

namespace PurchaseOrders.Api.Services
{
    /// <summary>
    /// Encapsulates the monetary approval policy. Kept separate from the
    /// service so the dollar thresholds live in one place.
    /// </summary>
    public class ApprovalPolicyHelper
    {
        // Orders at or above this amount always require an explicit manager
        // approval and can never be auto-approved, regardless of config.
        public const decimal ManagerApprovalThreshold = 10000m;

        /// <summary>
        /// Decides the approval outcome for an order that has already passed
        /// field validation and authorization.
        /// </summary>
        public ApprovalResult Evaluate(PurchaseOrder order, bool submitterIsManager)
        {
            // INDIRECTION: the $10,000 manager rule is enforced here, two calls
            // deep from the controller (controller -> service -> helper).
            if (order.Amount >= ManagerApprovalThreshold && !submitterIsManager)
            {
                return ApprovalResult.Denied(
                    "Orders of 10000 or more require a manager approver",
                    requiresManager: true);
            }

            if (submitterIsManager)
            {
                return ApprovalResult.Ok("Approved by manager");
            }

            // AMBIGUOUS: whether small orders auto-approve depends on a runtime
            // config flag that differs between environments.
            bool autoApprove = ReadAutoApproveEnabled();
            decimal ceiling = ReadAutoApproveCeiling();

            if (autoApprove && order.Amount < ceiling)
            {
                return ApprovalResult.Ok("Auto-approved under ceiling");
            }

            return ApprovalResult.Denied(
                "Manual review required",
                requiresManager: false);
        }

        private bool ReadAutoApproveEnabled()
        {
            string raw = ConfigurationManager.AppSettings["AutoApproveEnabled"];
            bool value;
            return bool.TryParse(raw, out value) && value;
        }

        private decimal ReadAutoApproveCeiling()
        {
            string raw = ConfigurationManager.AppSettings["AutoApproveCeiling"];
            decimal value;
            if (decimal.TryParse(raw, out value))
            {
                return value;
            }

            return ManagerApprovalThreshold;
        }
    }
}
