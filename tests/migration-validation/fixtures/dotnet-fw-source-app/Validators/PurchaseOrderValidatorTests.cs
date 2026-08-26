using PurchaseOrders.Api.Models;
using PurchaseOrders.Api.Validators;
using Xunit;

namespace PurchaseOrders.Tests.Validators
{
    public class PurchaseOrderValidatorTests
    {
        // Covers B1: a zero/negative amount is rejected with the exact message
        // "Amount must be greater than 0".
        [Fact]
        public void Validate_ZeroAmount_ReturnsAmountGreaterThanZeroMessage()
        {
            var validator = new PurchaseOrderValidator();
            var order = new PurchaseOrder
            {
                VendorName = "Acme Corp",
                Amount = 0m,
                CostCenter = "CC-100"
            };

            string result = validator.Validate(order);

            Assert.Equal("Amount must be greater than 0", result);
        }
    }
}
