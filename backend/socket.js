const fs      = require("fs");
const path    = require("path");
const jwt     = require("jsonwebtoken");
const xml2js  = require("xml2js");
const { Server } = require("socket.io");

const { DATA_DIR }     = require("./config/paths");
const { runExclusive } = require("./utils/fileQueue");

const startupFile = path.join(DATA_DIR, "startups.xml");
const builder      = new xml2js.Builder();

function readStartups(cb) {
    fs.readFile(startupFile, "utf8", (err, data) => {
        if (err) return cb(err);
        const parser = new xml2js.Parser({ explicitArray: true });
        parser.parseString(data, (err, result) => {
            if (err) return cb(err);
            if (!result?.startups) result = { startups: { startup: [] } };
            if (!Array.isArray(result.startups.startup)) result.startups.startup = [];
            cb(null, result);
        });
    });
}

function writeStartups(data, cb) {
    fs.writeFile(startupFile, builder.buildObject(data), cb);
}

/**
 * Attaches the real-time startup chat to an existing HTTP server.
 * @param {import("http").Server} httpServer
 * @param {string[]} allowedOrigins
 */
function attachSocket(httpServer, allowedOrigins) {
    const io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
            methods: ["GET", "POST"]
        }
    });

    // Every socket must present a valid JWT (issued at /login) before it can
    // join a room or send a message. This stops an unauthenticated client
    // from connecting directly to the socket and spoofing another user's email.
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("Authentication required"));
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = { email: payload.email, role: payload.role };
            next();
        } catch (err) {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id, "as", socket.user.email);

        // Client joins a startup chat room
        socket.on("joinRoom", ({ startupId }) => {
            if (!startupId) return;
            // Leave any previous startup room
            [...socket.rooms].forEach(r => { if (r !== socket.id) socket.leave(r); });
            socket.join("startup:" + startupId);
            console.log(`Socket ${socket.id} (${socket.user.email}) -> startup:${startupId}`);
        });

        // Client sends a message. The author is always the authenticated
        // user, never a value the client claims to be.
        socket.on("sendMessage", ({ startupId, text }) => {
            const email = socket.user.email;
            if (!startupId || !text?.trim()) return;

            runExclusive(startupFile, () => new Promise((resolve) => {
                readStartups((err, data) => {
                    if (err) { console.error("Read error:", err); return resolve(); }

                    const startup = data.startups.startup.find(s => s.id?.[0] === startupId);
                    if (!startup) return resolve();

                    if (!startup.messages)              startup.messages = [{ message: [] }];
                    if (!startup.messages[0].message)   startup.messages[0].message = [];

                    const ts = Date.now();
                    startup.messages[0].message.push({
                        author: [email],
                        text:   [text.trim()],
                        ts:     [ts.toString()]
                    });

                    writeStartups(data, () => {
                        io.to("startup:" + startupId).emit("newMessage", {
                            author: email,
                            text:   text.trim(),
                            ts
                        });
                        resolve();
                    });
                });
            }));
        });

        socket.on("disconnect", () => {
            console.log("Socket disconnected:", socket.id);
        });
    });

    return io;
}

module.exports = { attachSocket };
