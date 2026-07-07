// GitHub star count for the star pill. Fetched server-side (keeps api.github.com
// out of the browser CSP) and cached for 10 minutes. Degrades to null on any error
// so the pill just shows "Star on GitHub" without a count.

export const runtime = "nodejs";
export const revalidate = 600;

const REPO = "assafkip/theia";

export async function GET() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "theia-site" },
      next: { revalidate: 600 },
    });
    if (!r.ok) return Response.json({ stars: null });
    const d = await r.json();
    return Response.json({ stars: typeof d.stargazers_count === "number" ? d.stargazers_count : null });
  } catch {
    return Response.json({ stars: null });
  }
}
