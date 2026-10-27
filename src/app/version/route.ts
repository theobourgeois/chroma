/** The deploy this server is running, for apps left open across a deploy. */
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD }, { headers: { "Cache-Control": "no-store" } });
}
