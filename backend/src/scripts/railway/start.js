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
  if (!publishableKey) return;

  const updateClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await updateClient.connect();
    console.log("Ensuring publishable key matches MEDUSA_PUBLISHABLE_KEY...");

    // Check if any key already has this token to avoid unique constraint violation
    const checkRes = await updateClient.query(
      "SELECT id FROM api_key WHERE token = $1 LIMIT 1;",
      [publishableKey],
    );

    if (checkRes.rowCount > 0) {
      console.log("Publishable key already matches a record in the database.");
    } else {
      // Update the Webshop key, or the first publishable key found
      const res = await updateClient.query(
        "UPDATE api_key SET token = $1 WHERE id = (SELECT id FROM api_key WHERE title = $2 OR type = 'publishable' ORDER BY (title = $2) DESC, created_at ASC LIMIT 1);",
        [publishableKey, "Webshop"],
      );
      if (res.rowCount > 0) {
        console.log(`Successfully updated publishable key.`);
      } else {
        console.log(
          "No publishable keys found to update. (Expected if seeding hasn't created one yet)",
        );
      }
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
