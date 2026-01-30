const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const MEDUSA_SERVER_PATH = path.join(process.cwd(), ".medusa", "server");

if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error(
    ".medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.",
  );
}

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, path.join(MEDUSA_SERVER_PATH, ".env"));
}

console.log("Installing dependencies in .medusa/server...");
execSync("pnpm install --prod --no-frozen-lockfile", {
  cwd: MEDUSA_SERVER_PATH,
  stdio: "inherit",
  env: { ...process.env, CI: "true" },
});
