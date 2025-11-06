# Signup and Onboarding Flow

This document explains how TREAZRISLAND provisions its first administrator and how invited players finish account signup. The flow spans the public onboarding endpoints and the authenticated auth routes implemented in the Fastify backend.

## Initial Setup

1. **Check installation state**
   * `GET /onboarding/status`
   * Returns whether any users exist (`needsSetup`) and which setup steps (from `SetupState`) remain pending.
   * When no accounts exist, the `first-admin` step remains pending and the UI should guide the operator to create the initial administrator.
2. **Create the first admin**
   * `POST /onboarding/admin`
   * Requires an email, nickname, and password that satisfies the password policy (minimum 8 characters, at least one uppercase letter, and one digit).
   * Persists the admin via Prisma, hashes the password with Argon2id, marks the `first-admin` setup step as complete, issues access/refresh tokens, and sets the refresh cookie.
   * This endpoint is rate-limited via the shared auth rate limit window to protect against brute-force attempts during unattended installations.

After the first admin is created, subsequent setup steps (storage, email, personalization, etc.) can be updated through the authenticated onboarding step API (`PATCH /onboarding/steps/:stepKey`).

## Invitation-Based Signup

1. **Preview invitation metadata**
   * `POST /auth/invitations/preview`
   * Accepts a raw invitation token. The backend fingerprints the token with SHA-256 to locate the record and verifies the stored Argon2 hash to confirm authenticity.
   * Rejects missing, expired, redeemed, or tampered tokens with a `404` response. Rate limited by the auth window to reduce token spraying.
2. **Complete signup**
   * `POST /auth/signup`
   * Validates the invitation token as above, enforces the password policy, and ensures the submitted email matches the invitation when the inviter specified one.
   * Marks the invitation as redeemed, creates the user via Prisma, hashes the password with Argon2id, issues JWT access/refresh tokens, and sets the refresh cookie. Subsequent refresh rotations use the Fastify JWT configuration defined in `server.ts` and `utils/tokens.ts`.
3. **Authenticate**
   * `POST /auth/login`
   * Users authenticate with email or nickname plus password, optionally satisfying MFA challenges. The route is rate-limited according to `RATE_LIMIT_AUTH_POINTS/DURATION` to mitigate brute force attempts.
   * Successful logins return an access token and set the refresh cookie. Refresh (`POST /auth/refresh`) rotates the refresh token family with the same rate limit, and logout (`POST /auth/logout`) clears the cookie and revokes the refresh family.

## Password Policy Summary

* Minimum length: 8 characters
* At least one uppercase letter (`[A-Z]`)
* At least one digit (`[0-9]`)

The schema is shared between onboarding admin creation, invitation signup, and password reset confirmation to guarantee consistent enforcement.

## Security Notes

* Invitation tokens are stored as Argon2id hashes with a SHA-256 fingerprint for lookup. Compromise of the database does not reveal raw invitation tokens, and offline brute force is slowed by Argon2.
* Auth-related endpoints (`/auth/invitations/preview`, `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/password/reset/*`) share the auth rate limit window to defend against credential stuffing.
* Refresh cookies are cleared and the entire refresh-token family is revoked on logout or password reset, preventing stolen refresh tokens from persisting sessions.

Refer to `docs/TREAZRISLAND_PRD.md` and `docs/security/threat-model.md` for additional product and security context.
