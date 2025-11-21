const API_BASE = `${process.env.REACT_APP_SERVER_URL}/api/v1`;


async function safeParse(res) {
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { success: false, message: "Invalid response", raw: text }; }
}

export async function get(url) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  return safeParse(res);
}

export async function post(url, data = {}) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(data),
  });
  return safeParse(res);
}

export async function put(url, data = {}) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_BASE}${url}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(data),
  });
  return safeParse(res);
}

export async function remove(url) {
  const token = localStorage.getItem("token") || "";
  const res = await fetch(`${API_BASE}${url}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  return safeParse(res);
}
