const fs      = require("fs");
const path    = require("path");
const xml2js  = require("xml2js");
const { runExclusive } = require("../utils/fileQueue");

const { DATA_DIR } = require("../config/paths");
const xmlFilePath = path.join(DATA_DIR, "profiles.xml");

// Ensure file exists with valid root element
if (!fs.existsSync(xmlFilePath)) {
    fs.writeFileSync(xmlFilePath, "<profiles></profiles>");
}

// ── READ XML ──────────────────────────────────────────────────────────────────
function readXML(callback) {
    fs.readFile(xmlFilePath, "utf8", (err, data) => {
        if (err) return callback(err);

        const parser = new xml2js.Parser();
        parser.parseString(data, (err, result) => {
            if (err) return callback(err);

            // xml2js parses <profiles></profiles> as { profiles: '' }
            if (!result || !result.profiles || typeof result.profiles !== "object") {
                result = { profiles: { profile: [] } };
            }
            if (!Array.isArray(result.profiles.profile)) {
                result.profiles.profile = [];
            }

            callback(null, result);
        });
    });
}

// ── WRITE XML ─────────────────────────────────────────────────────────────────
function writeXML(data, callback) {
    const builder = new xml2js.Builder();
    const xml     = builder.buildObject(data);
    fs.writeFile(xmlFilePath, xml, callback);
}

// Ensures req.user (set by requireAuth) matches the :email / body email this
// route is trying to modify. Prevents user A from editing/deleting user B's
// profile just by changing a value in the request.
function assertOwnEmail(req, res, targetEmail) {
    if (!req.user || req.user.email.toLowerCase() !== String(targetEmail || "").toLowerCase()) {
        res.status(403).json({ message: "You can only modify your own profile" });
        return false;
    }
    return true;
}

// ── CREATE PROFILE ────────────────────────────────────────────────────────────
exports.createProfile = (req, res) => {
    const {
        name, email, program, joinYear, bio,
        phone, github, linkedin, portfolio,
        resume, profilePicture
    } = req.body;

    if (!name || !email || !program || !joinYear) {
        return res.status(400).json({ message: "Missing required fields" });
    }
    if (!assertOwnEmail(req, res, email)) return;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        readXML((err, result) => {
            if (err) { res.status(500).json({ message: "Error reading file" }); return resolve(); }

            const profiles = result.profiles.profile;
            const existing = profiles.find(p => p.email && p.email[0] === email);
            if (existing) { res.status(409).json({ message: "Profile already exists" }); return resolve(); }

            profiles.push({
                name:           [name],
                email:          [email],
                program:        [program],
                joinYear:       [joinYear],
                bio:            [bio            || ""],
                phone:          [phone          || ""],
                github:         [github         || ""],
                linkedin:       [linkedin       || ""],
                portfolio:      [portfolio      || ""],
                resume:         [resume         || ""],
                profilePicture: [profilePicture || "default.png"],
                skills:         [{ skill: [] }]
            });

            writeXML(result, (err) => {
                if (err) { res.status(500).json({ message: "Error saving profile" }); return resolve(); }
                res.status(201).json({ message: "Profile created successfully" });
                resolve();
            });
        });
    }));
};

// ── GET PROFILE ───────────────────────────────────────────────────────────────
exports.getProfile = (req, res) => {
    const { email } = req.params;

    readXML((err, result) => {
        if (err) return res.status(500).json({ message: "Error reading file" });

        const profile = result.profiles.profile.find(
            p => p.email && p.email[0] === email
        );
        if (!profile) return res.status(404).json({ message: "Profile not found" });
        res.json(profile);
    });
};

// ── UPDATE PROFILE ────────────────────────────────────────────────────────────
exports.updateProfile = (req, res) => {
    const { email } = req.params;
    const { bio, phone, github, linkedin, portfolio, resume, profilePicture } = req.body;

    if (!assertOwnEmail(req, res, email)) return;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        readXML((err, result) => {
            if (err) { res.status(500).json({ message: "Error reading file" }); return resolve(); }

            const profile = result.profiles.profile.find(
                p => p.email && p.email[0] === email
            );
            if (!profile) { res.status(404).json({ message: "Profile not found" }); return resolve(); }

            if (bio            !== undefined) profile.bio            = [bio];
            if (phone          !== undefined) profile.phone          = [phone];
            if (github         !== undefined) profile.github         = [github];
            if (linkedin       !== undefined) profile.linkedin       = [linkedin];
            if (portfolio      !== undefined) profile.portfolio      = [portfolio];
            if (resume         !== undefined) profile.resume         = [resume];
            if (profilePicture !== undefined) profile.profilePicture = [profilePicture];

            writeXML(result, (err) => {
                if (err) { res.status(500).json({ message: "Error updating profile" }); return resolve(); }
                res.json({ message: "Profile updated successfully" });
                resolve();
            });
        });
    }));
};

// ── ADD SKILL ─────────────────────────────────────────────────────────────────
exports.addSkill = (req, res) => {
    const { email, skill } = req.body;
    if (!email || !skill) return res.status(400).json({ message: "Email and skill required" });
    if (!assertOwnEmail(req, res, email)) return;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        readXML((err, result) => {
            if (err) { res.status(500).json({ message: "Error reading file" }); return resolve(); }

            const profile = result.profiles.profile.find(
                p => p.email && p.email[0] === email
            );
            if (!profile) { res.status(404).json({ message: "Profile not found" }); return resolve(); }

            if (!profile.skills || !profile.skills[0]) profile.skills = [{ skill: [] }];
            if (!profile.skills[0].skill)              profile.skills[0].skill = [];

            if (profile.skills[0].skill.some(s => s.trim().toLowerCase() === skill.trim().toLowerCase())) {
                res.status(409).json({ message: "Skill already exists" });
                return resolve();
            }

            profile.skills[0].skill.push(skill);

            writeXML(result, (err) => {
                if (err) { res.status(500).json({ message: "Error adding skill" }); return resolve(); }
                res.json({ message: "Skill added successfully" });
                resolve();
            });
        });
    }));
};

// ── DELETE SKILL ──────────────────────────────────────────────────────────────
exports.deleteSkill = (req, res) => {
    const { email, skill } = req.body;
    if (!email || !skill) return res.status(400).json({ message: "Email and skill required" });
    if (!assertOwnEmail(req, res, email)) return;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        readXML((err, result) => {
            if (err) { res.status(500).json({ message: "Error reading file" }); return resolve(); }

            const profile = result.profiles.profile.find(
                p => p.email && p.email[0] === email
            );
            if (!profile) { res.status(404).json({ message: "Profile not found" }); return resolve(); }

            if (!profile.skills || !profile.skills[0]?.skill) {
                res.status(404).json({ message: "No skills found" });
                return resolve();
            }

            profile.skills[0].skill = profile.skills[0].skill.filter(s => s !== skill);

            writeXML(result, (err) => {
                if (err) { res.status(500).json({ message: "Error removing skill" }); return resolve(); }
                res.json({ message: "Skill removed successfully" });
                resolve();
            });
        });
    }));
};

// ── DELETE PROFILE ────────────────────────────────────────────────────────────
exports.deleteProfile = (req, res) => {
    const { email } = req.params;
    if (!assertOwnEmail(req, res, email)) return;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        readXML((err, result) => {
            if (err) { res.status(500).json({ message: "Error reading file" }); return resolve(); }

            const before = result.profiles.profile.length;
            result.profiles.profile = result.profiles.profile.filter(
                p => !(p.email && p.email[0] === email)
            );
            if (result.profiles.profile.length === before) {
                res.status(404).json({ message: "Profile not found" });
                return resolve();
            }

            writeXML(result, (err) => {
                if (err) { res.status(500).json({ message: "Error deleting profile" }); return resolve(); }
                res.json({ message: "Profile deleted successfully" });
                resolve();
            });
        });
    }));
};

// ── GET ALL PROFILES ──────────────────────────────────────────────────────────
// Returns only student profiles — recruiters are excluded by cross-referencing
// the role field in users.xml. This prevents recruiter accounts that happen to
// have a profile entry from appearing in the Student Profiles view.
exports.getAllProfiles = (req, res) => {
    const usersFile = path.join(DATA_DIR, "users.xml");
    fs.readFile(usersFile, "utf8", (err, udata) => {
        if (err) return res.status(500).json({ message: "Error reading users" });
        const uParser = new xml2js.Parser({ explicitArray: true });
        uParser.parseString(udata, (err, uresult) => {
            if (err) return res.status(500).json({ message: "Error parsing users" });
            const users = uresult?.users?.user || [];
            const studentEmails = new Set(
                users
                    .filter(u => u.role?.[0] === "student")
                    .map(u => u.email?.[0])
            );
            readXML((err, result) => {
                if (err) return res.status(500).json({ message: "Error reading file" });
                const students = result.profiles.profile.filter(
                    p => studentEmails.has(p.email?.[0])
                );
                res.json(students);
            });
        });
    });
};

// ── SEARCH BY SKILL ───────────────────────────────────────────────────────────
exports.searchBySkill = (req, res) => {
    const { skill } = req.params;

    readXML((err, result) => {
        if (err) return res.status(500).json({ message: "Error reading file" });

        const filtered = result.profiles.profile.filter(p =>
            p.skills?.[0]?.skill?.some(s => s.trim().toLowerCase() === skill.trim().toLowerCase())
        );
        res.json(filtered);
    });
};
