// frontend/src/environment.js
// Normalise the environment server URL so callers can safely append routes like "/api/v1".
// Accepts either:
// - REACT_APP_SERVER_URL=https://example.com
// - REACT_APP_SERVER_URL=https://example.com/ or
// - REACT_APP_SERVER_URL=https://example.com/api  (we will strip the trailing /api)
const raw = process.env.REACT_APP_SERVER_URL || window.location.origin;

let server = raw.trim();

// remove trailing slashes
server = server.replace(/\/+$/, "");

// if user accidentally included "/api" at the end, remove it so app can add the correct prefix.
server = server.replace(/\/api(\/.*)?$/i, "");

// export a normalized base (no trailing slash, no /api)
export default server;
