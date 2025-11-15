# Changelog Template

Treazrisland follows [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH):

- **MAJOR** versions introduce breaking changes or incompatible database migrations.
- **MINOR** versions add backwards-compatible features and migrations.
- **PATCH** versions deliver backwards-compatible bug fixes, hotfixes, or content updates.

Every release entry should include the version, release date, summary, detailed sections, and upgrade/rollback notes. Copy the template below for each release.

```markdown
## [vX.Y.Z] - YYYY-MM-DD

### Summary

- High-level description of the release goals and expected impact.

### Added

- New features, content packs, or services.

### Changed

- Behavior updates, refactors, or performance optimizations.

### Fixed

- Bug fixes or regressions addressed.

### Database

- Migrations applied, new tables/indexes, seed data, and verification steps.

### Assets

- New or updated asset bundles, CDN changes, and cache purge requirements.

### Configuration

- New environment variables, default changes, or secrets to rotate.

### Upgrade Notes

- Special instructions, manual steps, or ordering constraints.

### Rollback Notes

- Supported down migrations, feature flags to disable, and required backup restoration steps.

### References

- Links to issues, design docs, or incident reports.
```
