import { PixelFrame } from "@/src/components/pixel-frame";
import SignupForm from "@/src/auth/signup-form";
import { previewInvitation } from "@/src/lib/api/invitations";

interface SignupPageProps {
  searchParams: {
    token?: string;
  };
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const token = searchParams.token?.trim();

  if (!token) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
        <PixelFrame className="space-y-4 max-w-lg text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Invitation Required</h1>
          <p className="text-sm text-slate-200">
            To join TREAZRISLAND you need a valid invitation token. Ask an administrator for an invite
            link and revisit this page once you have one.
          </p>
        </PixelFrame>
      </main>
    );
  }

  const { invitation, errorMessage } = await previewInvitation(token)
    .then(({ invitation }) => ({ invitation, errorMessage: null as string | null }))
    .catch((error: unknown) => ({
      invitation: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "We could not verify this invitation. Confirm the link or request a new token from your admin.",
    }));

  if (!invitation) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
        <PixelFrame className="space-y-4 max-w-lg text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Invitation Issue</h1>
          <p className="text-sm text-slate-200">
            {errorMessage ??
              "We could not verify this invitation. Confirm the link or request a new token from your admin."}
          </p>
        </PixelFrame>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-white">
      <PixelFrame className="space-y-6 max-w-lg">
        <header className="space-y-2 text-center">
          <h1 className="text-lg uppercase tracking-widest text-primary">Welcome Aboard</h1>
          <p className="text-sm text-slate-200">
            Complete your crew manifest below to unlock the island. This invitation grants a
            <span className="text-primary"> {" "}</span>
            <span className="text-primary">{invitation.role}</span> role.
          </p>
        </header>
        <SignupForm token={token} invitationEmail={invitation.email} role={invitation.role} />
      </PixelFrame>
    </main>
  );
}
