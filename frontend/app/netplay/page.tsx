import { PixelFrame } from "@/src/components/pixel-frame";
import { listNetplaySessions } from "@/src/lib/api/netplay";
import { HostForm } from "@/src/netplay/HostForm";
import { JoinForm } from "@/src/netplay/JoinForm";
import { SessionList } from "@/src/netplay/SessionList";

export const metadata = {
  title: "Netplay | TREAZRISLAND"
};

export default async function NetplayPage() {
  let sessions: Awaited<ReturnType<typeof listNetplaySessions>>["sessions"] = [];
  let fetchError: string | null = null;

  try {
    const response = await listNetplaySessions();
    sessions = response.sessions;
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Unable to load netplay sessions";
  }

  return (
    <main className="flex flex-1 flex-col gap-6 text-parchment">
      <PixelFrame className="space-y-6 bg-night/80 p-6 shadow-pixel">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.4em] text-lagoon">Crew Link</h1>
          <p className="text-sm text-parchment/80">
            Host a cooperative session or join your crew&apos;s lobby. Share the join code, rally the party, and sail into
            synchronous adventures.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <HostForm />
          <JoinForm />
        </div>
      </PixelFrame>

      <PixelFrame className="space-y-4 bg-night/80 p-6 shadow-pixel">
        <h2 className="text-xl font-semibold uppercase tracking-[0.4em] text-lagoon">Active Sessions</h2>
        {fetchError ? (
          <p className="text-sm text-red-300">{fetchError}</p>
        ) : (
          <SessionList initialSessions={sessions} />
        )}
      </PixelFrame>
    </main>
  );
}
