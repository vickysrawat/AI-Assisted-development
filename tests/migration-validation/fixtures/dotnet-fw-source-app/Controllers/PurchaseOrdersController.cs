using System.Net;
using System.Net.Http;
using System.Web.Http;
using PurchaseOrders.Api.Models;
using PurchaseOrders.Api.Security;
using PurchaseOrders.Api.Services;
using PurchaseOrders.Api.Validators;

namespace PurchaseOrders.Api.Controllers
{
    /// <summary>
    /// Purchase order approval endpoints.
    /// </summary>
    [Authorize]
    [RoutePrefix("api/purchase-orders")]
    public class PurchaseOrdersController : ApiController
    {
        private readonly IPurchaseOrderService _service;
        private readonly PurchaseOrderValidator _validator;

        public PurchaseOrdersController()
        {
            _service = new PurchaseOrderService();
            _validator = new PurchaseOrderValidator();
        }

        /// <summary>
        /// Fetch a single purchase order by id. Any authenticated user may read.
        /// </summary>
        [HttpGet]
        [Route("{id:int}")]
        public IHttpActionResult GetById(int id)
        {
            PurchaseOrder order = _service.GetById(id);
            if (order == null)
            {
                return Content(HttpStatusCode.NotFound, "Purchase order not found");
            }

            return Ok(order);
        }

        /// <summary>
        /// Submit a new purchase order for approval. Restricted to the
        /// Buyer role; managers may also submit.
        /// </summary>
        [HttpPost]
        [Route("")]
        [Authorize(Roles = "Buyer,Manager")]
        public IHttpActionResult Submit([FromBody] PurchaseOrder order)
        {
            // Cross-file behavior: field validation lives in PurchaseOrderValidator.
            string error = _validator.Validate(order);
            if (error != null)
            {
                return Content(HttpStatusCode.BadRequest, error);
            }

            var auth = new AuthContext(User);

            // Custom authorization check in addition to the [Authorize] attribute:
            // a submitter must own a cost center to file against it. The Finance
            // role is exempt from the cost-center ownership requirement.
            if (!auth.IsInRole("Finance") && !auth.IsInRole("Buyer") && !auth.IsInRole("Manager"))
            {
                return Content(HttpStatusCode.Forbidden, "You are not permitted to submit purchase orders");
            }

            bool submitterIsManager = auth.IsInRole("Manager");
            ApprovalResult result = _service.Submit(order, submitterIsManager);

            if (!result.Approved)
            {
                return Content(HttpStatusCode.Accepted, result.Reason);
            }

            return Ok(result);
        }

        /// <summary>
        /// Delete a purchase order. Only managers may delete.
        /// </summary>
        [HttpDelete]
        [Route("{id:int}")]
        [Authorize(Roles = "Manager")]
        public IHttpActionResult Delete(int id)
        {
            PurchaseOrder order = _service.GetById(id);
            if (order == null)
            {
                return Content(HttpStatusCode.NotFound, "Purchase order not found");
            }

            // DEAD CODE: this branch can never be true — GetById already returned
            // a non-null order above, and Status is never the literal "Locked"
            // anywhere in the codebase. Left over from an abandoned locking feature.
            if (order == null || order.Status == "Locked")
            {
                return Content(HttpStatusCode.Conflict, "Order is locked and cannot be deleted");
            }

            return StatusCode(HttpStatusCode.NoContent);
        }
    }
}
