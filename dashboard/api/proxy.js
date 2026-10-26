export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  const target =
    process.env.LAD_API_TARGET ||
    "https://d6l60no0kk.execute-api.eu-north-1.amazonaws.com";
  const token = process.env.LAD_ADMIN_TOKEN;

  const url = new URL(request.url);
  const upstreamUrl = `${target}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("host", new URL(target).host);
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          code: "UPSTREAM_ERROR",
          message: error?.message || "Failed to reach backend",
        },
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
