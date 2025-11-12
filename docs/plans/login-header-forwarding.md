# Plan: Forward Login Request Headers to Auth API

## Objectives
- Preserve the original request header context when invoking the auth API from the login server action.
- Allow the auth API client helpers to accept forwarded request headers so `resolveApiBase` can infer the correct backend origin.
- Expand automated coverage to prove headers are propagated end-to-end.

## Implementation Steps
1. **Capture caller headers inside the login action**
   - Import `headers` from `next/headers` within `frontend/app/(auth)/login/actions.ts`.
   - Invoke `headers()` at the start of `performLogin` and store the returned header getter.
   - Pass that getter through to `loginWithCookies` alongside the existing cookie header option.

2. **Accept forwarded headers in the auth client helper**
   - Extend `loginWithCookies` in `frontend/src/lib/api/auth.ts` so the optional options object includes a `requestHeaders` field typed as `HeaderGetter`.
   - Pass the `requestHeaders` value through to `apiRequest` so origin resolution can leverage the forwarded headers.

3. **Update tests to assert propagation**
   - Adjust `frontend/tests/auth/login-actions.test.ts` to mock `headers()` and return a deterministic `Headers` instance.
   - Expect `performLogin` to call `loginWithCookies` with the forwarded headers for both success and failure scenarios.
   - Keep existing cookie propagation assertions intact.

4. **Regression testing**
   - Run the Vitest suite via `npm test` from the `frontend/` directory to ensure the login flow remains healthy and the new assertions pass.

## Rollout & Validation
- No runtime configuration changes are required; the behaviour is scoped to server actions.
- Monitor authentication logs in lower environments to confirm requests now carry the correct origin when proxied through the frontend.
