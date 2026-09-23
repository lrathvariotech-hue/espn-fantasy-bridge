export async function onRequest(context) {
  const url = new URL(context.request.url);

  const week = url.searchParams.get("week");
  const compact = url.searchParams.get("compact") || "1";

  if (!week) {
    return new Response(
      JSON.stringify({
        error: "Bitte eine Woche angeben, z.B. /recap?week=1"
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  const target =
    `https://espn-fantasy-recap.l-rath-variotech.workers.dev` +
    `/recap?week=${encodeURIComponent(week)}` +
    `&compact=${encodeURIComponent(compact)}`;

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
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Bridge konnte den ESPN-Recap-Worker nicht erreichen",
        details: String(error)
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
