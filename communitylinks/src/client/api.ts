export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(endpoint);
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const res = await fetch(endpoint, { method: "DELETE" });
  return res.json() as Promise<T>;
}
