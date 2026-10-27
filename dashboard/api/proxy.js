export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  const target =
    process.env.LAD_API_TARGET ||
    "https://d6l60no0kk.execute-api.eu-north-1.amazonaws.com";
  const token = process.env.LAD_ADMIN_TOKEN;

  const url = new URL(request.url);
  const matchedPath =
    request.headers.get("x-matched-path") ||
    request.headers.get("x-invoke-path");
  const pathParam = url.searchParams.get("path");

  let targetPath = url.pathname;
  if (targetPath === "/api/proxy" || targetPath.endsWith("/proxy")) {
    if (matchedPath && matchedPath !== "/api/proxy") {
      targetPath = matchedPath;
    } else if (pathParam) {
      targetPath = `/api/${pathParam}`;
      url.searchParams.delete("path");
    }
  }

  const search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : "";
  const upstreamUrl = `${target}${targetPath}${search}`;

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
