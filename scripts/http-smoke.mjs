import assert from "node:assert/strict";
import { existsSync } from "node:fs";

// Only run against the fixture web server with NO live Supabase configuration.
if (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    [".env", ".env.local", ".env.production", ".env.production.local"].some(existsSync)) {
  throw new Error("HTTP smoke requires a clean checkout without live configuration");
}
const base = "http://127.0.0.1:3479";
const deadline = Date.now() + 15000;
let ready = false;
while (Date.now() < deadline) {
  try { ready = (await fetch(base + "/login")).status === 200; } catch { /* Server starting. */ }
  if (ready) break;
  await new Promise(resolve => setTimeout(resolve, 250));
}
assert(ready, "Fixture web server did not become ready");
for (const [path, expected] of [["/login", 200], ["/file.svg", 200], ["/employees", 307], ["/api/finance", 503], ["/pages/fixture.csv", 307], ["/pages/fixture.png", 307]]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, expected, "Unexpected fixture HTTP status");
  if (path === "/login") {
    const html = await response.text();
    assert(html.includes("Đăng nhập chưa được cấu hình"), "Missing setup explanation");
    assert(/<button[^>]*type="submit"[^>]*disabled/.test(html), "Unconfigured login must not submit passwords");
  }
  if (expected === 307)
    assert.equal(new URL(response.headers.get("location") || "/", base).pathname, "/login");
  console.log(path + ": PASS");
}
