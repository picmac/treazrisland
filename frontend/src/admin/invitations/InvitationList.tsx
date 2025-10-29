interface InvitationListProps {
  invitations: Array<{
    id: string;
    role: string;
    email: string | null;
    expiresAt: string;
    redeemedAt: string | null;
    createdAt: string;
  }>;
}

export function InvitationList({ invitations }: InvitationListProps) {
  if (invitations.length === 0) {
    return <p className="text-sm text-slate-300">No invitations issued yet.</p>;
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => {
        const expires = new Date(invitation.expiresAt).toLocaleString();
        const created = new Date(invitation.createdAt).toLocaleString();
        const redeemed = invitation.redeemedAt ? new Date(invitation.redeemedAt).toLocaleString() : null;

        return (
          <div key={invitation.id} className="rounded border border-primary/40 bg-background/50 p-3 text-sm text-white">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold uppercase tracking-widest text-primary">{invitation.role}</span>
              <span className="text-xs text-slate-400">Created {created}</span>
            </div>
            <div className="mt-1 text-xs text-slate-300">
              Email: {invitation.email ?? "Any"}
            </div>
            <div className="mt-1 text-xs text-slate-300">Expires: {expires}</div>
            <div className="mt-1 text-xs text-slate-300">
              Status: {redeemed ? `Redeemed at ${redeemed}` : "Pending"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
