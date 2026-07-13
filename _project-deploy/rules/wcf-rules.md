---
paths: ["**/*.svc", "**/*.cs", "**/ServiceContracts/**", "**/DataContracts/**"]
detect:
  files: ["**/*.svc"]
  dependencies: ["System.ServiceModel"]
---

> ⚠️ LEGACY — MAINTENANCE ONLY. WCF is in maintenance mode as of .NET 5+.
> Do not implement new services using WCF. For new inter-service communication,
> use REST (see `rest-api-rules.md`) or gRPC.
> `auth-rules.md` and `api-security-rules.md` still apply where feasible.

# WCF Rules — Windows Communication Foundation service maintenance

## Service Contracts
- `[ServiceContract]` on the interface, not the implementation class
- `[OperationContract]` on every method exposed as a service operation
- Service contracts are interfaces — implementation classes are not referenced by clients
- One service contract per bounded context — no monolithic "everything" service interface
- Operation names as verb + noun: `GetUser`, `UpdateFilter`, `DeleteAuditLog`

## Data Contracts
- `[DataContract]` on every DTO exchanged over the wire — never expose domain entities or ORM objects
- `[DataMember]` on every serialisable property; `Order` specified explicitly for binary-compatible versioning
- `[DataMember(IsRequired = false)]` for optional fields — allows adding fields without breaking older clients
- Namespaces set explicitly on `[DataContract(Namespace = "...")]` — never rely on the default (assembly-based) namespace
- No circular references in data contracts — WCF's `DataContractSerializer` does not handle them by default

## Bindings
- `BasicHttpBinding` for interoperability with non-.NET clients (SOAP 1.1)
- `WSHttpBinding` for .NET-to-.NET with security, reliable messaging, or transactions
- `NetTcpBinding` for high-performance intranet communication (binary encoding)
- Binding configuration in `web.config` / `app.config` — never hard-coded in code
- Security mode (`Transport`, `Message`, `TransportWithMessageCredential`) documented per binding

## Behaviors
- `[ServiceBehavior(InstanceContextMode = InstanceContextMode.PerCall)]` — default and safest; `PerSession` requires explicit session management
- Error handling via `IErrorHandler` registered as a service behavior — not try/catch in every operation
- Throttling configured via `serviceThrottling` behavior — `maxConcurrentCalls`, `maxConcurrentInstances`, `maxConcurrentSessions` set explicitly

## Error Handling
- Throw `FaultException<T>` for expected domain errors — not raw `Exception` (unhandled exceptions become generic fault messages)
- Define a `[DataContract]` fault detail type per domain error category
- Never expose exception messages or stack traces in fault details to external callers

## Auth (WCF-specific override)
- `[PrincipalPermission(SecurityAction.Demand, Role = "RoleName")]` for declarative role checks
- Identity resolved from `ServiceSecurityContext.Current.PrimaryIdentity` — never from a message header
- Windows Authentication or token-based (via custom `ISecurityTokenAuthenticator`) — document the auth scheme per binding

## Out of bounds
- No new WCF services — use REST or gRPC for new inter-service communication
- No domain entities in data contracts — always use a dedicated DTO
- No unhandled exceptions surfaced to clients — use `FaultException<T>`
- No hard-coded binding configuration in code — use config files
