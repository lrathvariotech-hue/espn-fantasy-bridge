const WORKER =
  "https://espn-fantasy-recap.l-rath-variotech.workers.dev";
Deno.serve(async (request) => {
  const url = new URL(request.url);
  // Health check
  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response("ESPN Fantasy Bridge – OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  // /recap?week=2
  if (url.pathname === "/recap") {
    const week = url.searchParams.get("week");
    if (!week) {
      return json({
        error: "Missing week parameter",
        example: "/recap?week=2",
      }, 400);
    }
    return fetchRecap(week);
  }
  // Fester Test-Endpunkt:
  // /week/2
  const match = url.pathname.match(/^\/week\/(\d+)$/);
  if (match) {
    return fetchRecap(match[1]);
  }
  return json({
    error: "Not found",
    endpoints: [
      "/health",
      "/recap?week=2",
      "/week/2"
    ]
  }, 404);
});
async function fetchRecap(week) {
  const target =
    `${WORKER}/recap?week=${encodeURIComponent(week)}&compact=1`;
  try {
    const response = await fetch(target);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json({
      error: "Cloudflare Worker konnte nicht erreicht werden",
      details: String(error),
    }, 502);
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
