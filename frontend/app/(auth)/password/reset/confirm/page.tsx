import { PixelFrame } from "@/src/components/pixel-frame";
import { PasswordResetConfirmForm } from "@/components/auth/password-reset-confirm-form";

interface PasswordResetConfirmPageProps {
  searchParams: {
    token?: string;
  };
}

export default function PasswordResetConfirmPage({ searchParams }: PasswordResetConfirmPageProps) {
  const token = searchParams.token?.trim();

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
        <PixelFrame className="space-y-4 max-w-lg text-center" tone="raised">
          <h1 className="text-lg uppercase tracking-widest text-primary">Missing reset token</h1>
          <p className="text-sm text-foreground/80">
            We couldn&apos;t find your reset token. Double-check the link from your email or request a new
            message.
          </p>
        </PixelFrame>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <PixelFrame className="space-y-6 max-w-md" tone="raised">
        <header className="space-y-2 text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Choose a new password</h1>
          <p className="text-sm text-foreground/80">
            Secure your treasure with a fresh passphrase. Once complete we&apos;ll guide you back to the
            island.
          </p>
        </header>
        <PasswordResetConfirmForm token={token} />
      </PixelFrame>
    </main>
  );
}
