# Architecture Overview

This document provides a high-level reference for Treazr Island's end-to-end system interactions. It focuses on how the web frontend, backend platform, and supporting services collaborate to deliver authentication, ROM management, and retro game play sessions.

## System Diagram

```mermaid
graph TD
  subgraph Client
    A[Web Frontend (Next.js)]
  end

  subgraph Platform
    B[Backend API (NestJS)]
    C[Auth Service]
    D[ROM Storage Service]
    E[Game Session Service]
    F[Observability Stack]
  end

  subgraph External
    G[(Relational DB)]
    H[(Object Storage)]
    I[(WebRTC Relay / Matchmaking)]
  end

  A -- HTTPS/GraphQL --> B
  B -- OAuth/OpenID Connect --> C
  B -- Metadata + Binary --> D
  B -- Session Lifecycle --> E
  E -- State + Save Data --> H
  D -- ROM Assets --> H
  C -- User Profiles --> G
  B -- Persistence --> G
  E -- Telemetry --> F
  B -- Metrics/Logs --> F
  E -- Low-latency Streams --> I
  A -- WebRTC / WebSocket --> E
```

**Component Summary**

- **Web Frontend (Next.js)**: Renders the player dashboard, manages login flows, and hosts the in-browser emulator shell.
- **Backend API (NestJS)**: Central orchestrator that mediates authentication, ROM ingestion, and live game sessions.
- **Auth Service**: Wraps the identity provider (IdP) for secure OAuth/OIDC login, session issuance, and token validation.
- **ROM Storage Service**: Handles ROM uploads, virus scanning hooks, metadata extraction, and lifecycle storage policies.
- **Game Session Service**: Provides deterministic emulation hosting, state streaming, and save data persistence.
- **Observability Stack**: Central place for structured logs, metrics, and traces emitted from the backend and session services.
- **Relational DB**: Stores users, entitlements, catalog metadata, and session history.
- **Object Storage**: Houses ROM binaries, save states, and emulator artifacts.
- **WebRTC Relay / Matchmaking**: Supports peer-to-peer media channels or relayed sessions when clients cannot connect directly.

## Key Sequence Diagrams

### Authentication Flow

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant F as Web Frontend
  participant A as Auth Service
  participant B as Backend API
  participant DB as Relational DB

  U->>F: Navigate to login
  F->>A: Redirect with OAuth request
  A-->>U: Consent + MFA (if needed)
  U->>A: Approve login
  A-->>F: Authorization code
  F->>B: Exchange code for tokens
  B->>A: Validate tokens / fetch claims
  A-->>B: User identity + scopes
  B->>DB: Fetch user profile / entitlements
  DB-->>B: Profile data
  B-->>F: Session cookie + profile payload
  F-->>U: Authenticated experience
```

### ROM Upload Flow

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant F as Web Frontend
  participant B as Backend API
  participant S as ROM Storage Service
  participant OS as Object Storage

  U->>F: Select ROM file
  F->>B: Initiate upload request
  B->>S: Request signed upload URL + metadata slot
  S->>OS: Create pre-signed PUT URL
  OS-->>S: Upload URL + object key
  S-->>B: Signed URL + ingestion token
  B-->>F: Upload instructions
  F->>OS: Upload ROM via signed URL
  OS-->>F: 200 OK
  F->>B: Notify upload completion
  B->>S: Trigger scan + metadata extraction
  S-->>B: Scan result + metadata
  B-->>F: Upload success + catalog entry
```

### Play Session Flow

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant F as Web Frontend
  participant B as Backend API
  participant G as Game Session Service
  participant H as Object Storage
  participant I as WebRTC Relay

  U->>F: Start selected game
  F->>B: Request session token
  B->>G: Create session + allocate emulator
  G->>H: Fetch ROM + latest save
  H-->>G: ROM binary + save data
  G-->>B: Session ready + signaling offer
  B-->>F: Session token + signaling details
  F->>I: Establish WebRTC channel (if relay needed)
  I-->>F: Relay confirmation
  F->>G: Connect via WebRTC/WebSocket
  G-->>F: Stream video/audio/state
  F-->>U: Render gameplay
  F->>B: Periodic heartbeat / telemetry
  B->>G: Forward control inputs / persistence triggers
  G->>H: Store periodic save states
  H-->>G: Save confirmation
```

These diagrams should remain version-controlled within this Markdown file to keep architectural discussions transparent and auditable.
