import { PixelFrame } from "@/src/components/pixel-frame";
import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";

export default function PasswordResetRequestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
      <PixelFrame className="space-y-6 max-w-md">
        <header className="space-y-2 text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Reset your access</h1>
          <p className="text-sm text-slate-200">
            Share the email tied to your TREAZRISLAND account and we&apos;ll deliver a reset link to your
            inbox.
          </p>
        </header>
        <PasswordResetRequestForm />
      </PixelFrame>
    </main>
  );
}
