export async function request(path, { key, ...options } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
    });
  } catch {
    throw new Error("Could not reach the server. Please try again.");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unexpected response.");
  }
  if (!response.ok) {
    const error = new Error(
      body.details?.map((issue) => issue.message).join(". ") ||
        body.error ||
        "Request failed",
    );
    error.status = response.status;
    throw error;
  }
  return body.data;
}

export const createLink = (url) =>
  request("/urls", { method: "POST", body: JSON.stringify({ url }) });
export const listLinks = (key) => request("/urls", { key });
export const getLink = (code, key) =>
  request(`/urls/${encodeURIComponent(code)}`, { key });
