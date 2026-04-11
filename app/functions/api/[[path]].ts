// Pages Function: proxy all /api/* requests to the Worker
const WORKER_URL = 'https://cat-tracker-api.stevej-67b.workers.dev'

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  const targetUrl = WORKER_URL + url.pathname + url.search

  const request = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: ['GET', 'HEAD'].includes(context.request.method) ? undefined : context.request.body,
  })

  // Use redirect:'manual' so the proxy doesn't follow redirects server-side.
  // Then reconstruct the response explicitly so the browser can process
  // Set-Cookie and other headers that would otherwise be lost on opaque redirects.
  const response = await fetch(request, { redirect: 'manual' })

  if (response.status >= 300 && response.status < 400) {
    return new Response(null, {
      status: response.status,
      headers: new Headers(response.headers),
    })
  }

  return response
}
