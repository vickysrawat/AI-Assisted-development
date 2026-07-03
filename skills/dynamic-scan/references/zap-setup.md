# ZAP Setup — Docker, Networking, Certs

## Image names (verified current)

Use the **zaproxy** org images. The old `owasp/zap2docker-*` names are retired.

| Image | Use |
|---|---|
| `ghcr.io/zaproxy/zaproxy:stable` | Default interactive scans |
| `ghcr.io/zaproxy/zaproxy:bare` | CI — minimal, fast pull |
| `ghcr.io/zaproxy/zaproxy:weekly` | Latest core + addons if a fix is needed |
| `zaproxy/zap-stable` (Docker Hub) | Interchangeable mirror of `ghcr` stable |

```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_MISSING
```

## localhost networking from inside Docker

`localhost` inside the container is the container, not the host machine.

- Windows / macOS Docker Desktop: use `http://host.docker.internal:PORT`.
- Linux: keep `host.docker.internal` but add `--add-host=host.docker.internal:host-gateway`.

Find the host IP as a fallback (`ipconfig` on Windows, `ip addr` on Linux).

## Windows Firewall (IIS targets)

IIS may block inbound from the Docker bridge. If ZAP cannot reach the app, allow inbound
on the app's port for the Private network profile, or temporarily disable the firewall for
that profile during the scan.

## HTTPS self-signed dev certs

Local IIS and `dotnet run` serve HTTPS with a dev cert ZAP rejects by default. Either:
- pass `-config certificate.use=false`, or
- import/accept the dev cert into ZAP.

This is ON by default for localhost targets in this skill (`--accept-cert`).

## Credential safety

ZAP stores credentials in session/context files as PLAINTEXT. Therefore:
- pass secrets via system-level env vars (`ZAP_USER`, `ZAP_PASS`, `ZAP_AUTH_HEADER_VALUE`);
- never commit `.session` / `.context` files;
- the skill deletes them in Step 6 cleanup;
- prefer a short-lived token over a password; revoke it after the scan.
