# Authentication API

The authentication endpoints power account onboarding, session rotation, MFA challenges, and password recovery. All routes are served from the Fastify backend and leverage HttpOnly refresh cookies (`treaz_refresh`) plus short-lived JWT access tokens.

> **Base URL**: `http://<backend-host>:3001`

## `POST /auth/signup`

Redeems an invitation token and creates a new user.

| Field         | Type     | Required | Notes |
|---------------|----------|----------|-------|
| `token`       | string   | ✅        | Raw invitation token from the invite email. |
| `email`       | string   | ⚠️        | Required when the invitation is email-less. Must match the invitation email when present. |
| `nickname`    | string   | ✅        | 3-32 characters. Used for login when email is absent. |
| `password`    | string   | ✅        | Minimum 8 chars, must include ≥1 uppercase letter and ≥1 digit. |
| `displayName` | string   | ❌        | Optional profile label (1-64 chars). Defaults to the nickname. |

**Success (201)**

```json
{
  "user": {
    "id": "user_123",
    "email": "player@example.com",
    "nickname": "retrofan",
    "role": "PLAYER"
  },
  "accessToken": "<JWT>",
  "refreshExpiresAt": "2025-01-12T18:22:11.000Z"
}
```

The response sets a `treaz_refresh` HttpOnly cookie for subsequent refreshes.

**Errors**

- `400`: Invalid payload, invitation expired, email mismatch, or email required.
- `409`: Email or nickname already taken.
- `500`: Unexpected signup error.

---

## `POST /auth/login`

Authenticates a user by email or nickname plus password. MFA is enforced when the account has an active secret.

| Field          | Type   | Required | Notes |
|----------------|--------|----------|-------|
| `identifier`   | string | ✅        | Email (case-insensitive) **or** nickname. |
| `password`     | string | ✅        | Plaintext password (≥8 chars). |
| `mfaCode`      | string | ❌        | 6-10 digit TOTP code. Mutually exclusive with `recoveryCode`. |
| `recoveryCode` | string | ❌        | 6-128 char recovery code. Mutually exclusive with `mfaCode`. |

**Success (200)**

```json
{
  "user": {
    "id": "user_123",
    "email": "player@example.com",
    "nickname": "retrofan",
    "role": "PLAYER"
  },
  "accessToken": "<JWT>",
  "refreshExpiresAt": "2025-01-12T19:01:05.000Z"
}
```

The response rotates the refresh cookie and records a login audit event.

**MFA Challenge (401)**

When MFA is enabled and no `mfaCode` or `recoveryCode` is provided, the endpoint returns:

```json
{
  "message": "MFA challenge required",
  "mfaRequired": true
}
```

Call `/auth/login` again with the appropriate code to complete the flow.

**Errors**

- `400`: Invalid payload (validation errors surfaced in `errors`).
- `401`: Invalid credentials or MFA verification failure.
- `429`: Rate limit exceeded (`RATE_LIMIT_AUTH_*` settings).
- `500`: MFA verification failure or unexpected error.

---

## `POST /auth/refresh`

Rotates the refresh token family and returns a new access token. Requires a valid `treaz_refresh` cookie.

**Success (200)**

```json
{
  "user": {
    "id": "user_123",
    "email": "player@example.com",
    "nickname": "retrofan",
    "role": "PLAYER"
  },
  "accessToken": "<JWT>",
  "refreshExpiresAt": "2025-01-19T07:14:00.000Z"
}
```

A fresh refresh cookie is issued alongside the response.

**Errors**

- `401`: Missing or invalid refresh cookie (clears the cookie).
- `500`: Unexpected rotation error.

---

## `POST /auth/logout`

Clears the refresh cookie and revokes the active refresh token family when present.

- **Success (204)**: Refresh cookie cleared, family revoked, and logout audit event recorded.
- **No Body** required.

The endpoint is idempotent; sending requests without a cookie still returns 204.

---

## MFA & Recovery Handling

MFA verification occurs inside `/auth/login` once a user has an active secret. Keep these points in mind:

- Provide either `mfaCode` **or** `recoveryCode`, never both.
- Recovery codes are single-use. When accepted they are removed and rotated.
- Failed challenges generate `mfa_failed` login audit entries for monitoring.

To seed MFA secrets, use the admin management flows exposed in the frontend; the API currently only verifies codes during login.

---

## Password Reset Flow

### `POST /auth/password/reset/request`

Starts the password reset process. Always returns a generic success message to avoid account enumeration.

| Field   | Type   | Required | Notes |
|---------|--------|----------|-------|
| `email` | string | ✅        | Email address to send the reset link. |

**Success (200)**

```json
{ "message": "If the account exists we sent reset instructions." }
```

**Errors**

- `400`: Invalid email payload.

---

### `POST /auth/password/reset/confirm`

Redeems a password reset token, updates the password, revokes all existing refresh families, and issues a new session.

| Field     | Type   | Required | Notes |
|-----------|--------|----------|-------|
| `token`   | string | ✅        | Token from the reset email (48-byte hex). |
| `password`| string | ✅        | New password matching the signup strength rules. |

**Success (200)**

```json
{
  "user": {
    "id": "user_123",
    "email": "player@example.com",
    "nickname": "retrofan",
    "role": "PLAYER"
  },
  "accessToken": "<JWT>",
  "refreshExpiresAt": "2025-01-12T20:33:42.000Z"
}
```

A new refresh cookie accompanies the response, and the reset is logged.

**Errors**

- `400`: Invalid payload or expired/unknown reset token.
- `500`: Unexpected failure during reset.

---

## Invitation Preview Helper

While not part of the signup flow above, `/auth/invitations/preview` lets the frontend validate tokens before rendering the signup form. It accepts `{ "token": "..." }` and returns the invite role/email when valid, otherwise `404`.

Use this helper when building invitation UX so the actual signup request can focus on credential submission.
