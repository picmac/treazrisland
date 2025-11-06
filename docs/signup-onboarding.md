# Signup & Onboarding Sequence

This guide explains how TREAZRISLAND brings a new installation online and how invited players complete their first login. All API routes are served from the Fastify backend (`http://<backend-host>:3001`).

## 1. Check setup status

1. Call `GET /onboarding/status`.
2. Inspect the response:
   - `needsSetup: true` indicates that no admin has been created yet or required steps remain.
   - `steps` lists each onboarding milestone (`first-admin`, storage, email, etc.) with their `status`.
   - `pendingSteps` enumerates the steps still marked as `PENDING`.

Only continue to the next step when the backend reports that an initial admin is still required.

## 2. Create the first admin

1. POST to `/onboarding/admin` with:
   ```json
   {
     "email": "admin@example.com",
     "nickname": "captain",
     "password": "SecretCaptain123"
   }
   ```
2. The password must be at least 8 characters and contain an uppercase letter, lowercase letter, and digit. The endpoint enforces the same policy that regular users see during signup.
3. A successful response returns the newly created admin plus a short-lived `accessToken`. The HttpOnly refresh cookie (`treaz_refresh`) is set automatically. The backend also marks the `first-admin` onboarding step as complete.

A strict rate limit (`RATE_LIMIT_AUTH_*` settings) protects this endpoint from brute-force attempts.

## 3. Track remaining onboarding steps

Authenticated admins can patch each setup milestone with `PATCH /onboarding/steps/:stepKey`. Provide a payload such as:

```json
{
  "status": "COMPLETED",
  "notes": "Configured local storage and SMTP",
  "settings": {
    "storage": { "driver": "filesystem" },
    "email": { "provider": "postmark" }
  }
}
```

Each patch updates the persisted settings and the step status. Once every step is `COMPLETED` or `SKIPPED`, `/onboarding/status` will return `setupComplete: true`.

## 4. Issue invitations

Admins generate invitations through `POST /users/invitations`. The backend responds with:

- The invitation metadata (`id`, `role`, `expiresAt`).
- A one-time token that is Argon2-hashed before being stored. Even if the database is compromised, raw tokens remain unrecoverable.

Rate limits from `RATE_LIMIT_AUTH_*` also apply here via the shared rate-limit plugin.

## 5. Invitee preview

When a player receives the token, they can confirm its validity by calling `POST /auth/invitations/preview` with `{ "token": "<raw-token>" }`. The server:

- Locates the invitation via a deterministic fingerprint.
- Verifies the token against the stored Argon2 digest.
- Returns the intended role and email (if present) without exposing the digest.

Invalid, expired, or tampered tokens respond with `404`.

## 6. Redeem the invitation

Players exchange the token for an account at `POST /auth/signup` using:

```json
{
  "token": "<raw-token>",
  "email": "player@example.com",
  "nickname": "pixelpirate",
  "password": "SecretPlayer123"
}
```

- If the invitation contains an email, the provided email must match.
- Passwords must satisfy the same policy described earlier.
- Successful signups receive an access token and a refresh cookie; the invitation is marked as redeemed and the login audit log records a `signup` event.

## 7. Sign in and manage sessions

- `POST /auth/login` authenticates a user by email or nickname plus password (and MFA when enabled). The route is rate-limited using the `RATE_LIMIT_AUTH_*` configuration.
- `POST /auth/refresh` exchanges the HttpOnly cookie for a new session, rotating the refresh token family and updating the cookie.
- `POST /auth/logout` clears the cookie and revokes the entire refresh token family for defense-in-depth.

Together, these flows provide a secure, rate-limited onboarding experience from the very first admin all the way through ongoing player authentication.
