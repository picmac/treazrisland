# Antivirus Validation – 2025-02-24

## Procedure
1. Installed ClamAV (`apt-get install clamav`).
2. Refreshed signature databases with `freshclam` (daily/main/bytecode).
3. Scanned the EICAR test file (`clamscan /tmp/eicar.com`).

## Result
- `clamscan` correctly detected the EICAR signature and reported 1 infected file.
- Reference output: see terminal chunk `3b1f95`.

## Notes
- `freshclam` emits a warning when `clamd` isn't running inside the container environment—expected for ephemeral validation runs.
- Repeat the validation whenever the upload antivirus container or signatures are updated.
