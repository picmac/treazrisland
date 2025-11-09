import { PixelFrame } from "@/src/components/pixel-frame";
import { LoginForm } from "@/src/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <PixelFrame className="space-y-6 max-w-md" tone="raised">
        <header className="space-y-2 text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Welcome Back</h1>
          <p className="text-sm text-foreground/80">
            Sign in to continue charting your adventures across TREAZRISLAND.
          </p>
        </header>
        <LoginForm />
      </PixelFrame>
    </main>
  );
}
