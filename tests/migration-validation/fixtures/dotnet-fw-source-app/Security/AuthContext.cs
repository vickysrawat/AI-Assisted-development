using System.Security.Principal;

namespace PurchaseOrders.Api.Security
{
    /// <summary>
    /// Thin wrapper over the current principal used for custom role checks
    /// in addition to the declarative [Authorize] attributes.
    /// </summary>
    public class AuthContext
    {
        private readonly IPrincipal _principal;

        public AuthContext(IPrincipal principal)
        {
            _principal = principal;
        }

        public bool IsAuthenticated
        {
            get { return _principal != null && _principal.Identity != null && _principal.Identity.IsAuthenticated; }
        }

        public string UserName
        {
            get { return _principal != null && _principal.Identity != null ? _principal.Identity.Name : null; }
        }

        public bool IsInRole(string role)
        {
            return _principal != null && _principal.IsInRole(role);
        }
    }
}
