// frontend/src/utils/api.js

const API_BASE = "https://gup-shapbackend.onrender.com";  

async function safeParse(res) {
  const txt = await res.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { success: res.ok, message: txt || "Unknown server response" };
  }
}

export async function get(url) {
  try {
    const token = localStorage.getItem("token") || "";

    const res = await fetch(`${API_BASE}${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    return await safeParse(res);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}

export async function post(url, data = {}) {
  try {
    const token = localStorage.getItem("token") || "";

    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(data),
    });

    return await safeParse(res);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}

export async function put(url, data = {}) {
  try {
    const token = localStorage.getItem("token") || "";

    const res = await fetch(`${API_BASE}${url}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(data),
    });

    return await safeParse(res);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}

export async function remove(url) {
  try {
    const token = localStorage.getItem("token") || "";

    const res = await fetch(`${API_BASE}${url}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    return await safeParse(res);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}
