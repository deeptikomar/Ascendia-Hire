const fs   = require("fs");
const os   = require("os");
const path = require("path");

const FIXTURES_DIR = path.join(__dirname, "../fixtures");
const SEED_FILES = ["users.xml", "jobs.xml", "startups.xml", "profiles.xml"];

/**
 * Creates a brand-new temp data directory seeded with empty XML files,
 * points the app at it via DATA_DIR, resets Jest's module registry so the
 * app/controllers pick up the new path, and returns a fresh Express app
 * ready for supertest.
 *
 * Call this once per test file (in beforeAll) — each test file gets its own
 * isolated "database" so tests never see each other's data and never touch
 * the real backend/database/*.xml files.
 */
function createTestApp() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ascendia-test-"));
    for (const file of SEED_FILES) {
        fs.copyFileSync(path.join(FIXTURES_DIR, file), path.join(dataDir, file));
    }

    process.env.DATA_DIR      = dataDir;
    process.env.JWT_SECRET    = "test_only_secret_never_use_in_prod";
    process.env.JWT_EXPIRES_IN = "1h";
    process.env.FRONTEND_URL  = "*";

    jest.resetModules();
    const { app } = require("../../app");
    return app;
}

module.exports = { createTestApp };
