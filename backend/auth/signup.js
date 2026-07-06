const fs      = require("fs");
const path    = require("path");
const xml2js  = require("xml2js");
const bcrypt  = require("bcryptjs");
const { runExclusive } = require("../utils/fileQueue");

const { DATA_DIR } = require("../config/paths");
const xmlFilePath = path.join(DATA_DIR, "users.xml");
const SALT_ROUNDS  = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.signup = (req, res) => {
    const { name, program, joinYear, email, password, company } = req.body;

    // role is sent explicitly from the frontend; fallback to email-domain detection
    let role = req.body.role;
    if (!role || !["student", "recruiter"].includes(role)) {
        role = typeof email === "string" && email.endsWith("@nitk.edu.in") ? "student" : "recruiter";
    }

    if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (role === "student" && !email.endsWith("@nitk.edu.in")) {
        return res.status(400).json({ message: "Students must sign up with a valid NITK email (@nitk.edu.in)" });
    }
    if (role === "student" && (!program || !joinYear)) {
        return res.status(400).json({ message: "Program and join year are required for students" });
    }
    if (role === "student" && !/^\d{4}$/.test(String(joinYear))) {
        return res.status(400).json({ message: "Join year must be a 4-digit year" });
    }

    const graduationYear = role === "student"
        ? (program === "BTech" ? parseInt(joinYear) + 4 : parseInt(joinYear) + 2)
        : null;

    runExclusive(xmlFilePath, () => new Promise((resolve) => {
        fs.readFile(xmlFilePath, "utf8", (err, data) => {
            if (err) { res.status(500).json({ message: "Database error" }); return resolve(); }

            xml2js.parseString(data, async (err, result) => {
                if (err) { res.status(500).json({ message: "Parse error" }); return resolve(); }

                if (!result.users)      result.users      = {};
                if (!result.users.user) result.users.user = [];

                const users = result.users.user;
                if (users.find(u => u.email[0].toLowerCase() === email.toLowerCase())) {
                    res.status(409).json({ message: "User already exists" });
                    return resolve();
                }

                let hashedPassword;
                try {
                    hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
                } catch (hashErr) {
                    res.status(500).json({ message: "Error securing password" });
                    return resolve();
                }

                const newUser = {
                    name:     [name],
                    email:    [email],
                    password: [hashedPassword],
                    role:     [role]
                };

                if (role === "student") {
                    newUser.program        = [program];
                    newUser.joinYear       = [joinYear];
                    newUser.graduationYear = [String(graduationYear)];
                }
                if (role === "recruiter" && company) {
                    newUser.company = [company];
                }

                users.push(newUser);

                const builder = new xml2js.Builder();
                const xml     = builder.buildObject(result);

                fs.writeFile(xmlFilePath, xml, (writeErr) => {
                    if (writeErr) { res.status(500).json({ message: "Error saving user" }); return resolve(); }
                    res.status(201).json({ message: "Signup successful" });
                    resolve();
                });
            });
        });
    }));
};
