const API_BASE = "https://gup-shapbackend.onrender.com";

export async function post(url, data) {
  try {
    const res = await fetch(API_BASE + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const text = await res.text();
    if (!text) return { success: false, message: "Empty response" };

    return JSON.parse(text);
  } catch (err) {
    return { success: false, message: "Network error" };
  }
}
