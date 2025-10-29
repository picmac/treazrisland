# Infrastructure Assets

Target location for Docker Compose definitions, deployment manifests, and infrastructure automation supporting the self-hosted TREAZRISLAND stack.

## Secrets management

ScreenScraper developer credentials are stored encrypted-at-rest. Generate encrypted blobs with `npm run screenscraper:encrypt` (see `docs/integrations/screenscraper.md`) and commit only the ciphertext. The decryption key (`SCREENSCRAPER_SECRET_KEY`) must be injected via your secret manager or deployment pipeline and **never** stored in plaintext under version control.
