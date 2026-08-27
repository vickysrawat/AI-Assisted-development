using System;
using System.Collections.Generic;
using PurchaseOrders.Api.Models;

namespace PurchaseOrders.Api.Services
{
    /// <summary>
    /// In-memory purchase order store and approval workflow. In a real system
    /// this would be backed by a repository; kept in-memory for the fixture.
    /// </summary>
    public class PurchaseOrderService : IPurchaseOrderService
    {
        private static readonly Dictionary<int, PurchaseOrder> Store =
            new Dictionary<int, PurchaseOrder>();

        private static int _nextId = 1;

        private readonly ApprovalPolicyHelper _policy;

        public PurchaseOrderService()
        {
            _policy = new ApprovalPolicyHelper();
        }

        public PurchaseOrder GetById(int id)
        {
            PurchaseOrder order;
            return Store.TryGetValue(id, out order) ? order : null;
        }

        public ApprovalResult Submit(PurchaseOrder order, bool submitterIsManager)
        {
            order.Id = _nextId++;
            order.CreatedUtc = DateTime.UtcNow;

            // Delegate the money policy to the helper (second level of indirection).
            ApprovalResult result = _policy.Evaluate(order, submitterIsManager);

            order.Status = result.Approved ? "Approved" : "PendingReview";
            Store[order.Id] = order;

            return result;
        }
    }
}
