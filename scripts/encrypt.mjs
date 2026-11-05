// Encrypts a self-contained HTML presentation behind a password.
//
// Usage:
//   DECK_PASSWORD='...' node scripts/encrypt.mjs path/to/deck.html [output.html]
//
// The output (index.html by default) contains only the AES-256-GCM ciphertext and a
// small unlock page. The password never appears in the output or in this repo.
// Keep the plain HTML outside the repo: the repo is public.

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes, pbkdf2Sync, createCipheriv } from "node:crypto";

const [, , input, output = "index.html"] = process.argv;
const password = process.env.DECK_PASSWORD;
if (!input || !password) {
  console.error("Usage: DECK_PASSWORD='...' node scripts/encrypt.mjs path/to/deck.html [output.html]");
  process.exit(1);
}

const plain = readFileSync(input);
const iterations = 600000;
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

// Reuse the deck's own @font-face rules on the unlock page (fonts are not secret).
const fonts = (plain.toString("utf8").match(/@font-face\{[^}]*\}/g) || []).join("\n");

const payload = JSON.stringify({
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  it: iterations,
  ct: ct.toString("base64"),
});

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Platform review</title>
<style>
${fonts}
:root { --pine: #0D2A21; --paper: #F3F5EF; --mint: #9EE6BC; --soft: #B9CCC2; --line: #2E4D42; --err: #F2A38F; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { background: var(--pine); color: var(--paper); font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; display: grid; place-items: center; padding: 24px; -webkit-font-smoothing: antialiased; }
main { width: 100%; max-width: 520px; }
h1 { font-stretch: 75%; font-weight: 640; font-size: clamp(48px, 9vw, 76px); line-height: .95; letter-spacing: -0.01em; margin: 0; }
p { color: var(--soft); font-size: 18px; line-height: 1.5; margin: 16px 0 32px; }
label { display: block; font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.row { display: flex; gap: 10px; }
input { flex: 1; min-width: 0; font-family: inherit; font-size: 18px; font-weight: 500; color: var(--paper); background: transparent; border: 1.5px solid var(--line); border-radius: 12px; padding: 14px 16px; }
input:focus-visible { outline: none; border-color: var(--mint); }
button { font-family: inherit; font-size: 17px; font-weight: 650; line-height: 1; color: var(--pine); background: var(--mint); border: 0; border-radius: 12px; padding: 0 22px; cursor: pointer; white-space: nowrap; }
button:focus-visible { outline: 3px solid var(--paper); outline-offset: 2px; }
button[disabled] { opacity: .6; cursor: progress; }
.msg { min-height: 24px; margin-top: 12px; font-size: 15px; color: var(--err); }
.msg.wait { color: var(--soft); }
</style>
</head>
<body>
<main>
  <h1>Platform review</h1>
  <p>Enter the password to open the presentation.</p>
  <form id="f" autocomplete="off">
    <label for="pw">Password</label>
    <div class="row">
      <input id="pw" type="password" autocomplete="current-password" required autofocus>
      <button id="go" type="submit">Open presentation</button>
    </div>
    <div class="msg" id="msg" role="status" aria-live="polite"></div>
  </form>
</main>
<script>
const P = ${payload};
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function unlock(pw) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(P.salt), iterations: P.it, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(P.iv) }, key, b64(P.ct));
  return new TextDecoder().decode(plain);
}
const f = document.getElementById("f"), pw = document.getElementById("pw"), go = document.getElementById("go"), msg = document.getElementById("msg");
f.addEventListener("submit", async e => {
  e.preventDefault();
  if (!window.crypto || !crypto.subtle) { msg.textContent = "This browser cannot open the presentation. Open the link over https in a current browser."; return; }
  go.disabled = true; msg.className = "msg wait"; msg.textContent = "Opening the presentation";
  try {
    const html = await unlock(pw.value);
    document.open(); document.write(html); document.close();
  } catch (err) {
    go.disabled = false; msg.className = "msg"; msg.textContent = "That password does not match. Check it and try again.";
    pw.select();
  }
});
</script>
</body>
</html>
`;

writeFileSync(output, page);
console.log("Wrote " + output + " (" + Math.round(page.length / 1024) + " KB)");
