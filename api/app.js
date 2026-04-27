const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const PUBLIC_ROOT = path.resolve(__dirname, "..");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function authToken() {
  const password = process.env.SITE_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || "change-this-secret";
  return sha256(`${password}:${secret}`);
}

function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function isAuthed(req) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return false;
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.vitrarq_auth === authToken();
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function send(res, statusCode, body, contentType = "text/html; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function loginPage(hasError = false) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Acesso restrito</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 20px;
        background: #eef2f3;
        color: #1e252b;
        font-family: Arial, Helvetica, sans-serif;
      }
      form {
        width: min(100%, 380px);
        border: 1px solid #e4e9ed;
        border-radius: 8px;
        background: #fff;
        padding: 24px;
        box-shadow: 0 18px 44px rgba(29, 42, 49, 0.18);
      }
      p.eyebrow {
        margin: 0 0 4px;
        color: #b56a16;
        font-size: .75rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      h1 { margin: 0 0 18px; font-size: 1.45rem; }
      label {
        display: grid;
        gap: 5px;
        color: #65717b;
        font-size: .82rem;
        font-weight: 700;
      }
      input {
        width: 100%;
        min-height: 38px;
        border: 1px solid #c9d1d8;
        border-radius: 6px;
        padding: 8px 10px;
        font: inherit;
      }
      button {
        width: 100%;
        min-height: 38px;
        margin-top: 12px;
        border: 0;
        border-radius: 6px;
        background: #16685f;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .error {
        min-height: 20px;
        margin: 8px 0 0;
        color: #9f2f23;
        font-size: .88rem;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <form method="post" action="/login">
      <p class="eyebrow">Acesso restrito</p>
      <h1>Orçamento VitrarQ</h1>
      <label>
        Senha
        <input name="password" type="password" autocomplete="current-password" autofocus>
      </label>
      <p class="error">${hasError ? "Senha incorreta." : ""}</p>
      <button type="submit">Entrar</button>
    </form>
  </body>
</html>`;
}

function safeFilePath(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const relativePath = cleanPath.replace(/^\/+/, "");
  const allowed =
    relativePath === "index.html" ||
    relativePath === "styles.css" ||
    relativePath === "script.js" ||
    relativePath.startsWith("assets/");

  if (!allowed) return null;

  const filePath = path.resolve(PUBLIC_ROOT, relativePath);

  if (!filePath.startsWith(PUBLIC_ROOT)) return null;
  return filePath;
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);

  if (url.pathname === "/login" && req.method === "GET") {
    return send(res, 200, loginPage(url.searchParams.get("error") === "1"));
  }

  if (url.pathname === "/login" && req.method === "POST") {
    const sitePassword = process.env.SITE_PASSWORD;
    if (!sitePassword) {
      return send(res, 500, "SITE_PASSWORD não configurada.");
    }

    const body = await readBody(req);
    const form = new URLSearchParams(body);
    const password = form.get("password") || "";

    if (password !== sitePassword) {
      return redirect(res, "/login?error=1");
    }

    res.setHeader(
      "Set-Cookie",
      `vitrarq_auth=${authToken()}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=28800`
    );
    return redirect(res, "/");
  }

  if (url.pathname === "/logout") {
    res.setHeader(
      "Set-Cookie",
      "vitrarq_auth=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0"
    );
    return redirect(res, "/login");
  }

  if (!isAuthed(req)) {
    return redirect(res, "/login");
  }

  const filePath = safeFilePath(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, "Arquivo não encontrado.");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  fs.createReadStream(filePath).pipe(res);
};
