import { auth } from "~/server/auth";
import { env } from "~/env";

/**
 * GET /api/whisper-status
 *
 * Authenticated lightweight health check for the local Whisper server.
 * Used by the UI to decide whether to show the mic button as enabled or disabled.
 * Times out quickly (2s) to not block the UI on load.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ available: false }, { status: 401 });
  }

  try {
    const res = await fetch(env.WHISPER_BASE_URL, {
      method: "GET",
      signal: AbortSignal.timeout(2_000),
    });
    // A 404 from the root path means the server is up but has no root handler — that's fine.
    const available = res.ok || res.status === 404;
    return Response.json({ available });
  } catch {
    return Response.json({ available: false });
  }
}
