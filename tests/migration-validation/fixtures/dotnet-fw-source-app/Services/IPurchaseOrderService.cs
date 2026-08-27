using PurchaseOrders.Api.Models;

namespace PurchaseOrders.Api.Services
{
    public interface IPurchaseOrderService
    {
        PurchaseOrder GetById(int id);

        ApprovalResult Submit(PurchaseOrder order, bool submitterIsManager);
    }
}
