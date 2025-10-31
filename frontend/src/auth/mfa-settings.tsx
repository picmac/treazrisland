"use client";

import Image from "next/image";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ApiError } from "@/src/lib/api/client";
import {
  confirmMfaSetup,
  disableMfa,
  startMfaSetup,
  type MfaSetupResponse,
} from "@/src/lib/api/auth";
import { toDataURL } from "qrcode";

interface MfaSettingsPanelProps {
  initialEnabled: boolean;
  accountEmail: string | null;
}

type StatusMessage = { type: "success" | "error"; text: string } | null;

type DisableFormState = {
  mfaCode: string;
  recoveryCode: string;
};

export function MfaSettingsPanel({ initialEnabled, accountEmail }: MfaSettingsPanelProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [setupBundle, setSetupBundle] = useState<MfaSetupResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableForm, setDisableForm] = useState<DisableFormState>({ mfaCode: "", recoveryCode: "" });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [isPending, startTransition] = useTransition();

  const friendlyAccountLabel = useMemo(() => {
    if (setupBundle?.secret && accountEmail) {
      return accountEmail;
    }
    return accountEmail ?? "your TREAZRISLAND account";
  }, [setupBundle?.secret, accountEmail]);

  const handleStartSetup = () => {
    setStatus(null);
    startTransition(async () => {
      try {
        setQrDataUrl(null);
        const result = await startMfaSetup();
        setSetupBundle(result);
        setConfirmCode("");
        setIsEnabled(false);
        try {
          const dataUrl = await toDataURL(result.otpauthUri, { margin: 1, scale: 6 });
          setQrDataUrl(dataUrl);
        } catch {
          setQrDataUrl(null);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          setStatus({ type: "error", text: `${error.status}: ${error.message}` });
        } else if (error instanceof Error) {
          setStatus({ type: "error", text: error.message });
        } else {
          setStatus({ type: "error", text: "Unable to start MFA setup." });
        }
      }
    });
  };

  const handleConfirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setupBundle) {
      return;
    }

    const trimmed = confirmCode.trim();
    if (trimmed.length === 0) {
      setStatus({ type: "error", text: "Enter the code from your authenticator app." });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      try {
        await confirmMfaSetup({ secretId: setupBundle.secretId, code: trimmed });
        setStatus({ type: "success", text: "MFA enabled. Store your recovery codes in a safe place." });
        setIsEnabled(true);
        setSetupBundle(null);
        setQrDataUrl(null);
        setConfirmCode("");
      } catch (error) {
        if (error instanceof ApiError) {
          setStatus({ type: "error", text: `${error.status}: ${error.message}` });
        } else if (error instanceof Error) {
          setStatus({ type: "error", text: error.message });
        } else {
          setStatus({ type: "error", text: "Unable to confirm MFA." });
        }
      }
    });
  };

  const handleDisable = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mfaCode = disableForm.mfaCode.trim();
    const recoveryCode = disableForm.recoveryCode.trim();

    if (!mfaCode && !recoveryCode) {
      setStatus({ type: "error", text: "Provide an MFA code or recovery code to disable the feature." });
      return;
    }

    setStatus(null);
    startTransition(async () => {
      try {
        await disableMfa({
          mfaCode: mfaCode || undefined,
          recoveryCode: recoveryCode || undefined,
        });
        setStatus({ type: "success", text: "MFA disabled. Consider re-enabling it soon." });
        setIsEnabled(false);
        setSetupBundle(null);
        setQrDataUrl(null);
        setDisableForm({ mfaCode: "", recoveryCode: "" });
      } catch (error) {
        if (error instanceof ApiError) {
          setStatus({ type: "error", text: `${error.status}: ${error.message}` });
        } else if (error instanceof Error) {
          setStatus({ type: "error", text: error.message });
        } else {
          setStatus({ type: "error", text: "Unable to disable MFA." });
        }
      }
    });
  };

  return (
    <section className="pixel-frame flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-lagoon">Multi-factor authentication</h2>
        <p className="text-sm text-parchment/80">
          Use a TOTP authenticator app to add a second layer of security. Once enabled, you&apos;ll enter a
          code each time you log in. Recovery codes are single-use and should be stored offline.
        </p>
      </header>

      {status && (
        <p
          className={`rounded-pixel border px-3 py-2 text-sm ${
            status.type === "success"
              ? "border-lagoon text-lagoon"
              : "border-red-500/60 text-red-200"
          }`}
        >
          {status.text}
        </p>
      )}

      {!isEnabled && !setupBundle && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-parchment/70">
            No MFA secret is active for this account. Kick off the setup flow to generate a QR code,
            shareable secret, and a fresh pack of recovery codes.
          </p>
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={isPending}
            className="self-start rounded-pixel bg-kelp px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-lagoon disabled:opacity-60"
          >
            {isPending ? "Preparing…" : "Enable MFA"}
          </button>
        </div>
      )}

      {setupBundle && (
        <div className="flex flex-col gap-4 rounded-pixel border border-ink/40 bg-night/40 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-lagoon">Step 1. Scan or enter the secret</h3>
            <p className="text-sm text-parchment/70">
              Add a new TOTP account in your authenticator app using the QR code or the secret below. The
              label will appear as <span className="font-semibold">TREAZRISLAND</span> for {friendlyAccountLabel}.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="Authenticator QR code"
                  width={128}
                  height={128}
                  unoptimized
                  className="h-32 w-32 rounded border border-lagoon bg-background p-2"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded border border-dashed border-lagoon/40 text-xs uppercase tracking-widest text-parchment/50">
                  QR loading…
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-parchment/50">Secret</span>
                <code className="rounded bg-night/70 px-3 py-2 text-sm tracking-widest text-lagoon">
                  {setupBundle.secret}
                </code>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-lagoon">Step 2. Save your recovery codes</h3>
            <p className="text-sm text-parchment/70">
              Store these codes somewhere offline. Each code works once if you lose access to your
              authenticator app.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {setupBundle.recoveryCodes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-night/70 px-3 py-2 text-center font-mono text-sm uppercase tracking-[0.2em] text-parchment"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>

          <form onSubmit={handleConfirm} className="flex flex-col gap-3">
            <label className="text-xs uppercase tracking-widest text-parchment/60" htmlFor="mfa-confirm-code">
              Step 3. Enter the current MFA code
            </label>
            <input
              id="mfa-confirm-code"
              value={confirmCode}
              onChange={(event) => setConfirmCode(event.target.value)}
              className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
              placeholder="123456"
              inputMode="numeric"
            />
            <button
              type="submit"
              disabled={isPending}
              className="self-start rounded-pixel bg-lagoon px-4 py-2 text-xs font-semibold uppercase tracking-widest text-night shadow-pixel transition hover:bg-kelp disabled:opacity-60"
            >
              {isPending ? "Verifying…" : "Confirm MFA"}
            </button>
          </form>
        </div>
      )}

      {isEnabled && !setupBundle && (
        <form onSubmit={handleDisable} className="flex flex-col gap-3 rounded-pixel border border-red-500/40 bg-red-900/10 p-4">
          <h3 className="text-lg font-semibold text-red-200">Disable MFA</h3>
          <p className="text-sm text-red-200/80">
            Turning off MFA removes the extra login challenge. Enter a current MFA code or one of your
            recovery codes to proceed.
          </p>
          <label className="text-xs uppercase tracking-widest text-parchment/60" htmlFor="mfa-disable-code">
            MFA code
          </label>
          <input
            id="mfa-disable-code"
            value={disableForm.mfaCode}
            onChange={(event) =>
              setDisableForm((previous) => ({ ...previous, mfaCode: event.target.value }))
            }
            className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
            placeholder="123456"
            inputMode="numeric"
          />
          <label className="text-xs uppercase tracking-widest text-parchment/60" htmlFor="mfa-disable-recovery">
            Recovery code
          </label>
          <input
            id="mfa-disable-recovery"
            value={disableForm.recoveryCode}
            onChange={(event) =>
              setDisableForm((previous) => ({ ...previous, recoveryCode: event.target.value }))
            }
            className="w-full rounded-pixel border border-ink/40 bg-night/70 px-3 py-2 text-parchment focus:border-lagoon focus:outline-none"
            placeholder="TREAZ-XXXX-XXXX"
          />
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-pixel border border-red-400 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-red-200 transition hover:border-red-200 disabled:opacity-60"
          >
            {isPending ? "Disabling…" : "Disable MFA"}
          </button>
        </form>
      )}
    </section>
  );
}

export default MfaSettingsPanel;
