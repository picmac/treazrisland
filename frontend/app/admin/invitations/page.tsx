import { PixelFrame } from "@/src/components/pixel-frame";
import { listInvitations } from "@/src/lib/api/invitations";
import { AdminInvitationForm } from "@/src/admin/invitations/AdminInvitationForm";
import { InvitationList } from "@/src/admin/invitations/InvitationList";

export default async function AdminInvitationsPage() {
  let invitations: Awaited<ReturnType<typeof listInvitations>>["invitations"] = [];
  let fetchError: string | null = null;

  try {
    const data = await listInvitations();
    invitations = data.invitations;
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Unable to load invitations";
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-4 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-widest text-primary">Invitation Forge</h1>
          <p className="text-sm text-slate-200">
            Mint new invitations for trusted crewmates. Generated tokens appear below and can be distributed
            securely.
          </p>
        </header>
        <AdminInvitationForm />
      </PixelFrame>

      <PixelFrame className="space-y-3 p-6">
        <h2 className="text-lg uppercase tracking-widest text-primary">Recent Invitations</h2>
        {fetchError ? (
          <p className="text-sm text-red-300">{fetchError}</p>
        ) : (
          <InvitationList invitations={invitations} />
        )}
      </PixelFrame>
    </main>
  );
}
