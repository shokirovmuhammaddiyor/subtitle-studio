export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Expose-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    let targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      const path = url.pathname.slice(1);
      if (path.startsWith("http://") || path.startsWith("https://")) {
        targetUrl = path + url.search;
      }
    }

    if (!targetUrl) {
      return new Response(
        JSON.stringify({
          status: "ready",
          service: "Subtitle Studio Pro CORS Proxy",
          usage: "Pass target URL via ?url=https://..."
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      const forwardHeaders = new Headers();

      const range = request.headers.get("range") || request.headers.get("Range");
      if (range) {
        forwardHeaders.set("Range", range);
      }

      forwardHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
      forwardHeaders.set("Accept", "*/*");
      forwardHeaders.set("Accept-Encoding", "identity");

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        redirect: "follow",
        cf: {
          cacheEverything: false
        }
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "*");
      responseHeaders.set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range, Content-Length, Content-Disposition, Content-Type, ETag, Last-Modified");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Proxy Fetch Error", message: err.message }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
