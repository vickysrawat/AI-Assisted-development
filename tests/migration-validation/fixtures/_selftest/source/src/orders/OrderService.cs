// Self-test fixture — synthetic source. NOT real code. Line numbers are load-bearing:
// the good inventory cites #L42 and the range #L20-L28. Keep this file > 42 lines.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Fixture.Orders
{
    public class OrderService
    {
        private readonly IOrderRepository _orders;

        public OrderService(IOrderRepository orders)
        {
            _orders = orders;
        }

        // Lines ~20-28: quantity validation rule — rejects non-positive quantity with a 400.
        public OrderResult Create(OrderRequest request)
        {
            if (request.Quantity <= 0)
            {
                return OrderResult.BadRequest("Quantity must be positive");
            }

            if (string.IsNullOrWhiteSpace(request.Sku))
            {
                return OrderResult.BadRequest("Sku is required");
            }

            var order = new Order
            {
                Sku = request.Sku,
                Quantity = request.Quantity,
                CreatedAt = DateTime.UtcNow,
            };

            _orders.Add(order);

            // Line ~42: returns 201 with the created order id.
            return OrderResult.Created(order.Id);
        }

        public IReadOnlyList<Order> ListOpen()
        {
            return _orders.All().Where(o => !o.Fulfilled).ToList();
        }
    }
}
