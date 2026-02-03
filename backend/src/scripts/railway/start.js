const { execSync } = require("child_process");
const { Client } = require("pg");
const path = require("path");
const fs = require("fs");

const MEDUSA_SERVER_PATH = path.join(process.cwd(), ".medusa/server");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const checkIfSeeded = async () => {
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM "user" LIMIT 1;');
    return res.rowCount && res.rowCount > 0;
  } catch (error) {
    if (error.message.includes('relation "user" does not exist')) {
      return false;
    }
    console.error("Unexpected error checking if database is seeded:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
};

const ensurePublishableKey = async () => {
  const publishableKey = process.env.MEDUSA_PUBLISHABLE_KEY;
  if (!publishableKey) {
    console.log(
      "MEDUSA_PUBLISHABLE_KEY not set, skipping publishable key sync.",
    );
    return;
  }

  const updateClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await updateClient.connect();
    console.log("Ensuring publishable key matches MEDUSA_PUBLISHABLE_KEY...");

    // Fetch all publishable keys
    const { rows } = await updateClient.query(
      "SELECT id, token FROM api_key WHERE type = 'publishable' ORDER BY created_at ASC",
    );

    if (rows.length === 0) {
      throw new Error(
        "No publishable key found in the database. Ensure the seed script has run.",
      );
    }

    const [firstKey, ...extraKeys] = rows;
    if (firstKey.token !== publishableKey) {
      await updateClient.query("UPDATE api_key SET token = $1 WHERE id = $2", [
        publishableKey,
        firstKey.id,
      ]);
      console.log(
        `Updated publishable key (ID: ${firstKey.id}) to match environment variable.`,
      );
    } else {
      console.log(
        `Publishable key (ID: ${firstKey.id}) already matches environment variable.`,
      );
    }
  } catch (error) {
    console.error("Failed to update publishable key:", error);
  } finally {
    await updateClient.end();
  }
};

const start = async () => {
  console.log("Starting Railway initialization...");

  if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
    console.error(
      `Error: ${MEDUSA_SERVER_PATH} does not exist. Please run 'pnpm run build' first.`,
    );
    process.exit(1);
  }

  if (process.env.MEDUSA_WORKER_MODE === "worker") {
    console.log("Running in worker mode, skipping database seeding.");
    return;
  }

  try {
    console.log("Running migrations...");
    execSync("medusa db:migrate", {
      cwd: MEDUSA_SERVER_PATH,
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to run migrations:", error);
    process.exit(1);
  }

  const isSeeded = await checkIfSeeded();
  if (!isSeeded) {
    console.log("Database is not seeded. Seeding now...");
    try {
      console.log("Running seed script...");
      execSync("medusa exec ./src/scripts/seed.js", {
        cwd: MEDUSA_SERVER_PATH,
        stdio: "inherit",
      });

      const adminEmail = process.env.MEDUSA_ADMIN_EMAIL;
      const adminPassword = process.env.MEDUSA_ADMIN_PASSWORD;
      if (adminEmail && adminPassword) {
        console.log("Creating admin user...");
        execSync(`medusa user -e "${adminEmail}" -p "${adminPassword}"`, {
          cwd: MEDUSA_SERVER_PATH,
          stdio: "inherit",
        });
      }

      console.log("Database seeded and admin user created successfully.");
    } catch (error) {
      console.error("Failed to seed database or create admin user:", error);
      process.exit(1);
    }
  } else {
    console.log("Database is already seeded. Skipping seeding.");
  }

  await ensurePublishableKey();
};

start();
