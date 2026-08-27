using System;
using PurchaseOrders.Api.Models;

namespace PurchaseOrders.Api.Validators
{
    /// <summary>
    /// Field-level validation for an incoming purchase order.
    /// Applied by the controller before any service work happens.
    /// </summary>
    public class PurchaseOrderValidator
    {
        // Orders above this amount are rejected outright at validation time.
        public const decimal MaxAmount = 250000m;

        /// <summary>
        /// Returns the first validation error message, or null if the order is valid.
        /// </summary>
        public string Validate(PurchaseOrder order)
        {
            if (order == null)
            {
                return "Purchase order body is required";
            }

            if (string.IsNullOrWhiteSpace(order.VendorName))
            {
                return "Vendor name is required";
            }

            if (order.Amount <= 0m)
            {
                return "Amount must be greater than 0";
            }

            if (order.Amount > MaxAmount)
            {
                return "Amount must not exceed 250000";
            }

            if (string.IsNullOrWhiteSpace(order.CostCenter))
            {
                return "Cost center is required";
            }

            return null;
        }
    }
}
