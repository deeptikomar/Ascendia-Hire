const express = require("express");
const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");
const { requireAuth } = require("../middleware/auth");
const { runExclusive } = require("../utils/fileQueue");

const router = express.Router();

const { DATA_DIR } = require("../config/paths");
const filePath = path.join(DATA_DIR, "startups.xml");

const builder = new xml2js.Builder();


// ================= READ =================
function readData(callback) {
    fs.readFile(filePath, "utf8", (err, data) => {

        if (err) return callback(err);

        // Fresh parser per call — xml2js parsers are stateful and must not
        // be reused across calls. explicitArray: true prevents xml2js from
        // collapsing a single <member> or <skill> child into a plain string.
        const parser = new xml2js.Parser({ explicitArray: true });

        parser.parseString(data, (err, result) => {

            if (err) return callback(err);

            if (!result || typeof result !== 'object' || !result.startups) {
                result = { startups: { startup: [] } };
            }

            if (!Array.isArray(result.startups.startup)) {
                result.startups.startup = [];
            }

            callback(null, result);
        });
    });
}


// ================= WRITE =================
function writeData(data, callback) {
    const xml = builder.buildObject(data);
    fs.writeFile(filePath, xml, callback);
}


// ================= POST STARTUP =================
router.post("/post", requireAuth, (req, res) => {

    const { title, description, skills } = req.body;
    const email = req.user.email;

    if (!title) return res.status(400).json({ message: "Title is required" });

    runExclusive(filePath, () => new Promise((resolve) => {
        readData((err, data) => {
            if (err) { res.status(500).json({ message: "Database read error" }); return resolve(); }

            const newStartup = {
                id: [Date.now().toString()],
                title: [title],
                description: [description || ""],
                creator: [email],

                requiredSkills: [{
                    skill: Array.isArray(skills) ? skills : []
                }],

                team: [{
                    member: [email]
                }]
            };

            data.startups.startup.push(newStartup);

            writeData(data, () => {
                res.status(201).json({ message: "Startup posted successfully" });
                resolve();
            });
        });
    }));

});


// ================= GET ALL =================
router.get("/all", (req, res) => {

    readData((err, data) => {

        if (err) {
            return res.status(500).json({ message: "Database read error" });
        }

        res.json(data.startups.startup);
    });

});


// ================= JOIN STARTUP =================
router.post("/join", requireAuth, (req, res) => {

    const { startupId } = req.body;
    const email = req.user.email;

    if (!startupId) return res.status(400).json({ message: "startupId is required" });

    runExclusive(filePath, () => new Promise((resolve) => {
        readData((err, data) => {
            if (err) { res.status(500).json({ message: "Database read error" }); return resolve(); }

            const startup = data.startups.startup.find(
                s => s.id[0] === startupId
            );

            if (!startup) { res.status(404).json({ message: "Startup not found" }); return resolve(); }

            if (!startup.team) {
                startup.team = [{ member: [] }];
            }

            if (!startup.team[0].member) {
                startup.team[0].member = [];
            }

            if (startup.team[0].member.includes(email)) {
                res.status(409).json({ message: "Already joined" });
                return resolve();
            }

            startup.team[0].member.push(email);

            writeData(data, () => {
                res.json({ message: "Joined successfully" });
                resolve();
            });
        });
    }));

});


// ================= TEAM MEMBERS =================
router.get("/team/:id", (req, res) => {

    const startupId = req.params.id;

    readData((err, data) => {

        if (err) {
            return res.status(500).json({ message: "Database read error" });
        }

        const startup = data.startups.startup.find(
            s => s.id[0] === startupId
        );

        if (!startup) {
            return res.status(404).json({ message: "Startup not found" });
        }

        const members =
            startup.team?.[0]?.member || [];

        res.json({
            startupId,
            members
        });

    });

});


// ================= DELETE STARTUP =================
// Only the creator can delete their startup.
router.delete("/delete/:id", requireAuth, (req, res) => {

    const startupId = req.params.id;
    const email = req.user.email;

    runExclusive(filePath, () => new Promise((resolve) => {
        readData((err, data) => {
            if (err) { res.status(500).json({ message: "Database read error" }); return resolve(); }

            const startups = data.startups.startup;

            const index = startups.findIndex(
                s => s.id[0] === startupId
            );

            if (index === -1) { res.status(404).json({ message: "Startup not found" }); return resolve(); }

            if (startups[index].creator?.[0] !== email) {
                res.status(403).json({ message: "Access denied" });
                return resolve();
            }

            startups.splice(index, 1);

            writeData(data, () => {
                res.json({ message: "Deleted successfully" });
                resolve();
            });
        });
    }));

});


// ================= SKILL GAP FEATURE =================
router.get("/skill-gap/:startupId", requireAuth, (req, res) => {

    const { startupId } = req.params;
    const email = req.user.email;

    const profileFile = path.join(DATA_DIR, "profiles.xml");

    fs.readFile(profileFile, "utf8", (err, pdata) => {

        if (err) return res.status(500).json({ message: "Profile read error" });

        xml2js.parseString(pdata, (err, presult) => {
            if (err) return res.status(500).json({ message: "Profile parse error" });

            const profiles = presult.profiles.profile;
            const profile = profiles.find(p => p.email[0] === email);

            if (!profile) {
                return res.status(404).json({ message: "Profile not found" });
            }

            const userSkills = profile.skills?.[0]?.skill || [];

            readData((err, sdata) => {
                if (err) return res.status(500).json({ message: "Database read error" });

                const startup = sdata.startups.startup.find(
                    s => s.id[0] === startupId
                );

                if (!startup) {
                    return res.status(404).json({ message: "Startup not found" });
                }

                const required =
                    startup.requiredSkills?.[0]?.skill || [];

                const normalize = s => s.trim().toLowerCase();
                const userSkillsNorm = userSkills.map(normalize);
                const missing = required.filter(
                    skill => !userSkillsNorm.includes(normalize(skill))
                );

                res.json({
                    userSkills,
                    required,
                    missing
                });

            });

        });

    });

});


// ================= GET ONE STARTUP =================
router.get("/:id", (req, res) => {

    readData((err, data) => {

        if (err) return res.status(500).json({ message: "Database read error" });

        const startup = data.startups.startup.find(
            s => s.id?.[0] === req.params.id
        );

        if (!startup) return res.status(404).json({ message: "Startup not found" });

        res.json(startup);
    });
});


// ================= POST MESSAGE =================
// Kept as a REST fallback alongside the Socket.IO chat. The author is
// always the authenticated caller.
router.post("/:id/message", requireAuth, (req, res) => {

    const { text } = req.body;
    const email = req.user.email;

    if (!text?.trim()) {
        return res.status(400).json({ message: "Message text is required" });
    }

    runExclusive(filePath, () => new Promise((resolve) => {
        readData((err, data) => {
            if (err) { res.status(500).json({ message: "Database read error" }); return resolve(); }

            const startup = data.startups.startup.find(
                s => s.id?.[0] === req.params.id
            );

            if (!startup) { res.status(404).json({ message: "Startup not found" }); return resolve(); }

            // Initialise messages array if this is the first post
            if (!startup.messages) {
                startup.messages = [{ message: [] }];
            }
            if (!startup.messages[0].message) {
                startup.messages[0].message = [];
            }

            startup.messages[0].message.push({
                author: [email],
                text:   [text.trim()],
                ts:     [Date.now().toString()]
            });

            writeData(data, () => {
                res.json({ message: "Message posted" });
                resolve();
            });
        });
    }));
});


module.exports = router;
