Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (url.pathname !== "/recap") {
    return new Response("ESPN Fantasy Bridge – OK", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  const week = url.searchParams.get("week");
  if (!week) {
    return new Response(
      JSON.stringify({
        error: "Bitte eine Woche angeben, z.B. /recap?week=2",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }
  const target =
    `https://espn-fantasy-recap.l-rath-variotech.workers.dev` +
    `/recap?week=${encodeURIComponent(week)}&compact=1`;
  try {
    const response = await fetch(target);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Cloudflare-Worker konnte nicht erreicht werden",
        details: String(error),
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }
});
