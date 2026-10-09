// Verifies every deep-dive URL in the v2 glossary still resolves.
// Usage: npm run check:links
import { readFile } from "node:fs/promises";

const src = await readFile(new URL("../src/v2/content/glossary.ts", import.meta.url), "utf8");
const urls = [...new Set([...src.matchAll(/url: "(https?:[^"]+)"/g)].map((m) => m[1]))];

let failed = 0;
async function check(url, attempt = 0) {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 link-check" } });
    // Some hosts refuse scripted clients outright; 403 there isn't a dead link.
    const ok = res.status < 400 || res.status === 403;
    if (!ok) failed++;
    console.log(`${ok ? "ok " : "BAD"} ${res.status} ${url}${res.url !== url ? `  → ${res.url}` : ""}`);
  } catch (err) {
    if (attempt < 2) return check(url, attempt + 1);
    failed++;
    console.log(`ERR ${url} ${err.cause?.code ?? err.message}`);
  }
}
// A few at a time: hammering 60 hosts at once trips rate limits and sockets.
const queue = [...urls];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await check(queue.shift());
}));
console.log(`\n${urls.length - failed}/${urls.length} links resolve`);
process.exit(failed ? 1 : 0);
