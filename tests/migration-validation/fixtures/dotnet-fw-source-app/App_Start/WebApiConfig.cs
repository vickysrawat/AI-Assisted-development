using System.Web.Http;

namespace PurchaseOrders.Api
{
    /// <summary>
    /// Web API configuration and route registration. Attribute routing is
    /// enabled so [Route]/[RoutePrefix] on the controllers take effect.
    /// </summary>
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            config.MapHttpAttributeRoutes();

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional });
        }
    }
}
