// frontend/src/utils/api.js
const API_BASE = "https://gup-shapbackend.onrender.com";

export async function post(url, data) {
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const text = await res.text();
    if (!res.ok) {
      try { return JSON.parse(text); } catch { return { success: false, message: text || "Server error" }; }
    }
    if (!text) return { success: true };
    return JSON.parse(text);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}
