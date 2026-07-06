require("dotenv").config();

console.log("Starting Ascendia Hire server...");

const http = require("http");
const { app, allowedOrigins } = require("./app");
const { attachSocket } = require("./socket");

if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not set. Copy backend/.env.example to backend/.env and set a value.");
    process.exit(1);
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
attachSocket(server, allowedOrigins);

server.listen(PORT, () => {
    console.log(`Ascendia Hire -> http://localhost:${PORT}`);
});
