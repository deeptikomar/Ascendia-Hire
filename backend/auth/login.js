const fs      = require("fs");
const path    = require("path");
const xml2js  = require("xml2js");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");

const { DATA_DIR } = require("../config/paths");
const xmlFilePath = path.join(DATA_DIR, "users.xml");
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

exports.login = (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }

    fs.readFile(xmlFilePath, "utf8", (err, data) => {
        if (err) return res.status(500).json({ message: "Database error" });

        xml2js.parseString(data, async (err, result) => {
            if (err) return res.status(500).json({ message: "Parse error" });

            const users = result.users?.user || [];
            const user  = users.find(u => u.email[0].toLowerCase() === email.toLowerCase());

            // Same generic message for "no such user" and "wrong password" so we
            // don't leak which emails are registered.
            const invalidCreds = () => res.status(401).json({ message: "Invalid email or password" });

            if (!user) return invalidCreds();

            const storedPassword = user.password[0];
            let passwordMatches = false;
            try {
                // Support legacy plaintext rows that predate the bcrypt migration
                // (e.g. seed data) as well as properly hashed ones.
                passwordMatches = storedPassword.startsWith("$2")
                    ? await bcrypt.compare(password, storedPassword)
                    : storedPassword === password;
            } catch (compareErr) {
                return res.status(500).json({ message: "Error verifying credentials" });
            }
            if (!passwordMatches) return invalidCreds();

            // Block students who have graduated
            const gradYear = parseInt(user.graduationYear?.[0]);
            if (user.role?.[0] === "student" && gradYear && gradYear < new Date().getFullYear()) {
                return res.status(403).json({ message: "Access expired - you have graduated." });
            }

            const role = user.role?.[0] || "student";
            const token = jwt.sign(
                { email: user.email[0], role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            res.json({
                message:        "Login successful",
                token,
                email:          user.email[0],
                name:           user.name?.[0] || "",
                role,
                program:        user.program?.[0]        || "",
                joinYear:       user.joinYear?.[0]       || "",
                graduationYear: user.graduationYear?.[0] || "",
                company:        user.company?.[0]        || ""
            });
        });
    });
};
