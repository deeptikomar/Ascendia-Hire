const path = require("path");

// Defaults to the real database/ folder, but can be pointed at a temp
// directory in tests (see backend/tests/helpers/setup.js) so test runs
// never read or write the app's real XML data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../database");

module.exports = { DATA_DIR };
