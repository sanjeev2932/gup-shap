// frontend/src/utils/api.js

const API_BASE = "https://gup-shapbackend.onrender.com/api/auth";


// ===== FIXED safeParse =====
async function safeParse(res) {
  const txt = await res.text();

  let json = null;
  try {
    json = JSON.parse(txt);
  } catch {
    return {
      success: false,
      message: "Invalid server response",
      raw: txt
    };
  }

  if (json.error) {
    return { success: false, message: json.error };
  }

  if (json.success === false) {
    return json;
  }

  return json; // success
}

// ===== GET =====
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
  } catch {
    return { success: false, message: "Network error" };
  }
}

// ===== POST =====
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
  } catch {
    return { success: false, message: "Network error" };
  }
}

// ===== PUT =====
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
  } catch {
    return { success: false, message: "Network error" };
  }
}

// ===== DELETE =====
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
  } catch {
    return { success: false, message: "Network error" };
  }
}
