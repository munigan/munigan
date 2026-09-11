import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const forbidden = [
  "oauth-e2e:",
  "oauth-e2e-client-secret",
  "discord-fetch-preload",
  "OAUTH_E2E_HARNESS",
  "auth-build-discord-secret-canary",
  "auth-build-stable-secret-canary-32-characters",
];
let checked = 0;
function scan(directory: string) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) scan(path);
    else {
      const content = readFileSync(path);
      if (forbidden.some((value) => content.includes(value)))
        throw new Error(
          "Production output contains test-provider or credential material",
        );
      checked++;
    }
  }
}
scan(".next/server");
scan(".next/static");
const manifest = JSON.parse(
  readFileSync(".next/prerender-manifest.json", "utf8"),
);
for (const route of ["/en-us", "/pt-br"]) {
  if (!manifest.routes[route])
    throw new Error("Localized homepage was not prerendered");
}
console.log(
  `Checked ${checked} production files: no harness or credential canaries; both localized homepages prerendered.`,
);
