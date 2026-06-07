export default async function handler(req) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "World";
  return new Response(JSON.stringify({ message: `Hello ${name}!` }), {
    headers: { "content-type": "application/json" }
  });
}
