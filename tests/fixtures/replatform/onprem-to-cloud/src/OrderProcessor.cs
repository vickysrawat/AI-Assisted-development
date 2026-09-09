// Fixture: on-prem order processor. Signals for cloud-capability decomposition —
// MSMQ read (messaging), SQL write (data), file-share write (blob), Windows Task Scheduler entry point.
using System.Data.SqlClient;
using System.IO;
using System.Messaging;

namespace LegacyOrders
{
    // Invoked on-prem by Windows Task Scheduler every 5 minutes.
    public class OrderProcessor
    {
        private readonly string _conn = "Server=ONPREM-SQL01;Database=Orders;Integrated Security=SSPI;";
        private readonly MessageQueue _queue = new MessageQueue(@".\private$\orders");
        private readonly string _share = @"\\FILESRV01\invoices";

        public void ProcessNext()
        {
            var msg = _queue.Receive();
            using (var db = new SqlConnection(_conn))
            {
                db.Open();
                // ... persist the order to SQL Server ...
            }
            File.WriteAllText(Path.Combine(_share, "latest.txt"), "processed");
        }
    }
}
