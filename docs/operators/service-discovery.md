# Internal API Service Discovery

TREAZRISLAND deployments must resolve the Fastify backend through a private
network endpoint. The frontend refuses to talk to public API hosts and now
issues a `/health/ready` probe against the configured internal address before
serving any requests. This document outlines discovery patterns for common
platforms.

## Kubernetes

1. Expose the backend deployment via a ClusterIP service:

   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: treaz-backend
     namespace: games
   spec:
     selector:
       app: treaz-backend
     ports:
       - name: http
         port: 3001
         targetPort: 3001
   ```

2. Create an internal DNS entry that resolves to the service (CoreDNS supports
   `svc.cluster.local` names automatically). Reference it from the frontend via
   `AUTH_API_BASE_URL`:

   ```bash
   export AUTH_API_BASE_URL="http://treaz-backend.games.svc.cluster.local:3001"
   ```

   The default production fallback (`http://api.internal.svc`) can be fulfilled
   by adding a `Service` or `ExternalName` resource with that hostname if you
   prefer a friendlier alias.

## Consul or Nomad

1. Register the backend service with the Consul catalog. A minimal definition
   looks like:

   ```hcl
   service {
     name = "treaz-backend"
     address = "10.0.5.42"
     port = 3001
     checks = [
       {
         name     = "http"
         type     = "http"
         path     = "/health/ready"
         interval = "15s"
       }
     ]
   }
   ```

2. Configure Consul DNS or mesh gateways to publish the service under a private
   hostname (for example `treaz-backend.service.consul`). Point
   `AUTH_API_BASE_URL` at that hostname:

   ```bash
   export AUTH_API_BASE_URL="http://treaz-backend.service.consul:3001"
   ```

## Bare metal or Docker Compose

For Compose-based deployments the backend container already listens on the
`backend` hostname inside the project network. Continue to set
`AUTH_API_BASE_URL=http://backend:3001` in the shared environment file. If you
introduce a private DNS zone (Pi-hole, pfSense, etc.), create an A record such
as `api.internal.svc` that resolves to the Docker host and update the Compose
`extra_hosts` or reverse proxy configuration accordingly.

## Verification checklist

- `AUTH_API_BASE_URL` resolves to a non-public address from the frontend host.
- `curl -sSf $AUTH_API_BASE_URL/health/ready` succeeds from the frontend
  container or pod.
- `NEXT_PUBLIC_API_BASE_URL` is **not** set in production builds unless the
  backend is intentionally public.
- Frontend logs do not emit `ApiConfigurationError`; if they do, confirm DNS
  and network policies allow the health probe to reach the backend.

Once these checks pass, the runtime health probe guarantees that the frontend
uses only internal networking to communicate with the API.
