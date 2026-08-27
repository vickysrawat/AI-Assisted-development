using System;

namespace PurchaseOrders.Api.Models
{
    /// <summary>
    /// A purchase order submitted for approval.
    /// </summary>
    public class PurchaseOrder
    {
        public int Id { get; set; }

        public string VendorName { get; set; }

        public decimal Amount { get; set; }

        public string CostCenter { get; set; }

        public string SubmittedBy { get; set; }

        public string Status { get; set; }

        public DateTime CreatedUtc { get; set; }
    }
}
