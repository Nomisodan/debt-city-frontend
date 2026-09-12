// Reads a fetch response as JSON, but falls back to a clean error instead of a raw
// "Unexpected token" parse error when the server (or a hosting platform in front of it)
// returns an HTML error page instead of JSON — e.g. a misconfigured VITE_API_URL.
export async function readJson(res, fallbackMessage) {
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    if (!res.ok) throw new Error(`${fallbackMessage} (server returned ${res.status} ${res.statusText})`)
    throw new Error('Server returned an unexpected response')
  }
  if (!res.ok) throw new Error(data?.error ?? fallbackMessage)
  return data
}
