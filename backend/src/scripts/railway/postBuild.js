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

const args = process.argv.slice(2);
const skipProdInstall = args.includes("--dev");

if (skipProdInstall) {
  console.log(
    "Skipping production install in .medusa/server as per --dev flag.",
  );
  console.log(
    "The server will use the existing node_modules from the project.",
  );
} else {
  console.log("Installing production dependencies in .medusa/server...");
  execSync("pnpm install --prod --no-frozen-lockfile", {
    cwd: MEDUSA_SERVER_PATH,
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
  });
}
