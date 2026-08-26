namespace PurchaseOrders.Api.Models
{
    /// <summary>
    /// Outcome of an approval attempt returned by the service layer.
    /// </summary>
    public class ApprovalResult
    {
        public bool Approved { get; set; }

        public string Reason { get; set; }

        public bool RequiresManager { get; set; }

        public static ApprovalResult Ok(string reason)
        {
            return new ApprovalResult { Approved = true, Reason = reason };
        }

        public static ApprovalResult Denied(string reason, bool requiresManager)
        {
            return new ApprovalResult
            {
                Approved = false,
                Reason = reason,
                RequiresManager = requiresManager
            };
        }
    }
}
