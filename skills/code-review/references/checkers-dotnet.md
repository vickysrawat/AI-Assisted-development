# Coverity Checkers — .NET / C# / ASP.NET / WCF / EF

## TAINTED_* — Data Flow (C#)

| Pattern | Checker | Example |
|---------|---------|---------|
| `Request.Query["x"]` concatenated into SQL | TAINTED_SQL | `"SELECT * FROM T WHERE id=" + Request.Query["id"]` |
| `Request.Form["x"]` passed to `Process.Start` | TAINTED_CMD | `Process.Start("cmd", "/c " + Request.Form["cmd"])` |
| `RouteData` value written to `Response.Write` | TAINTED_HTML | `Response.Write(RouteData.Values["name"])` |
| `Request.QueryString` used in `Path.Combine` without validation | TAINTED_PATH | `Path.Combine(baseDir, Request.QueryString["file"])` |
| `Request.Query["url"]` passed to `HttpClient.GetAsync` | TAINTED_SSRF | `await client.GetAsync(Request.Query["url"])` |
| `Request` value passed to `JsonSerializer.Deserialize<dynamic>` | TAINTED_DESERIALIZE | Untrusted type loading |
| `Request` value passed to `Response.Redirect` | TAINTED_REDIRECT | Open redirect |

## NULL_RETURNS — C# Patterns

| Pattern | Risk |
|---------|------|
| `.FirstOrDefault()` result used without null check | NullReferenceException in production |
| `.Find()` on DbSet used without null check | |
| `as` cast result used without null check | |
| `Nullable<T>.Value` without `.HasValue` check | |
| `ConfigurationManager.AppSettings["key"]` without null check | |
| `Environment.GetEnvironmentVariable("X")` used directly | |

## RESOURCE_LEAK — C# Patterns

| Object | Safe pattern |
|--------|-------------|
| `SqlConnection` | `using var conn = new SqlConnection(...)` |
| `SqlCommand` | `using var cmd = new SqlCommand(...)` |
| `StreamReader` / `StreamWriter` | `using var reader = new StreamReader(...)` |
| `FileStream` | `using var fs = File.Open(...)` |
| `HttpClient` | Inject as singleton; do not `new` per request |
| `MemoryStream` | `using var ms = new MemoryStream()` |
| `IDbTransaction` | `using var tx = conn.BeginTransaction()` |
| `CancellationTokenSource` | `using var cts = new CancellationTokenSource()` |

## CHECKED_RETURN — C# Patterns

| Ignored return | Risk |
|----------------|------|
| `int.TryParse()` bool result ignored | Silent parse failure |
| `Task` not awaited (`async void` callers) | Unhandled exception swallowed |
| `bool Remove()` / `bool TryRemove()` result ignored | Silent collection mutation failure |
| `File.Exists()` not checked before `File.Open()` | IOException |
| `Directory.CreateDirectory()` result not checked | |

## CONCURRENCY — C# Patterns

| Pattern | Checker |
|---------|---------|
| `static` mutable field written from multiple threads without `lock` | RACE_CONDITION |
| `await` inside `lock` block | LOCK_EVASION (compile error in modern C#, but flag in older) |
| `async void` event handler with no try/catch | THREAD_LEAKED |
| `Task.Run()` result not stored or awaited | THREAD_LEAKED |
| Two locks acquired in different order in two methods | DEADLOCK |
| `Thread.Sleep()` in async method | SLEEP (use Task.Delay) |

## ASP.NET / MVC Specific

| Pattern | Checker | Detail |
|---------|---------|--------|
| `[ValidateInput(false)]` with tainted data used in HTML | TAINTED_HTML | Request validation bypass |
| `Redirect(returnUrl)` without `Url.IsLocalUrl()` check | TAINTED_REDIRECT | Open redirect |
| `@Html.Raw(model.Property)` where property is user input | TAINTED_HTML | XSS |
| CSRF token missing on state-changing action | API_MISUSE | Missing `[ValidateAntiForgeryToken]` |
| `ViewState` MAC disabled (`EnableViewStateMac=false`) | LOGIC_ERROR | Tampering risk |

## Entity Framework Specific

| Pattern | Checker | Detail |
|---------|---------|--------|
| `FromSqlRaw($"... {userInput}")` — string interpolation | TAINTED_SQL | Use `FromSqlInterpolated` |
| `Database.ExecuteSqlRaw(userInput)` | TAINTED_SQL | Use parameterised overload |
| Navigation property accessed after context disposed | NULL_RETURNS | Lazy load on disposed context |
| `SaveChanges()` result (int) ignored | CHECKED_RETURN | Silent failure |
| `context.Dispose()` not called / not in `using` | RESOURCE_LEAK | |

## WCF (Windows Communication Foundation) Specific

| Pattern | Checker | Detail | Fix |
|---------|---------|--------|-----|
| `basicHttpBinding` with `security mode="None"` on internet-facing endpoint | TAINTED_* | Plaintext transport, credentials exposed | Set `<security mode="Transport">` (HTTPS) or `Message` |
| `mexHttpBinding` / `serviceMetadata httpGetEnabled="true"` in production | API_MISUSE | WSDL metadata publicly exposed | Set `httpGetEnabled="false"` in production |
| `includeExceptionDetailInFaults="true"` in production | SWALLOWED_EXC | Stack traces leaked to clients | Set to `false`; log server-side only |
| `NetDataContractSerializer` deserializing untrusted data | TAINTED_DESERIALIZE | Arbitrary type instantiation (CWE-502) | Use `DataContractSerializer` with known types |
| `maxItemsInObjectGraph` not set on DataContractSerializer | RESOURCE_LEAK | DoS via deeply nested object graph | Cap `maxItemsInObjectGraph` |
| `clientCredentialType="None"` on message-secured binding | TAINTED_* | No authentication on secured endpoint | Require `Windows`, `Certificate`, or `UserName` |
| Missing `<serviceThrottling>` config | THREAD_LEAKED | Default limits high — DoS risk | Set `maxConcurrentCalls`, `maxConcurrentSessions` |
| `ServiceHost` created but not closed on error path | RESOURCE_LEAK | Host leak; port not released | Wrap in try/finally; call `Abort()` on exception, `Close()` on success |
| `ChannelFactory<T>` / client proxy not closed | RESOURCE_LEAK | Channel and connection leak | `using` not safe for WCF proxies — use try/Close/Abort pattern |
| `UserName` credential over HTTP without transport security | TAINTED_* | Cleartext password | Pair with HTTPS transport |
| `replayDetection` not enabled on message-secured binding | API_MISUSE | Replay attack window | Enable `<localClientSettings>` replay detection |

**WCF proxy disposal note**: `IClientChannel` / generated proxies throw in `Dispose()` if the
channel is faulted, so a plain `using` block can mask the original exception. Flag any `using`
around a WCF client proxy and recommend the explicit pattern:
```csharp
var client = new MyServiceClient();
try
{
    var result = client.DoWork(input);
    client.Close();
    return result;
}
catch (CommunicationException)
{
    client.Abort();
    throw;
}
catch (TimeoutException)
{
    client.Abort();
    throw;
}
```
