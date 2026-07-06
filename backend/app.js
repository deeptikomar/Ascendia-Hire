const express = require("express");
const path    = require("path");

const signupController = require("./auth/signup");
const loginController  = require("./auth/login");
const profile          = require("./profile/profile");
const startupRoutes    = require("./startup/startup");
const jobsRoutes       = require("./jobs/jobs");
const { requireAuth }  = require("./middleware/auth");

// Allow one or more comma-separated origins via FRONTEND_URL. Falls back to
// permissive "*" only when nothing is configured, so local/dev usage still
// works out of the box.
const allowedOrigins = (process.env.FRONTEND_URL || "*")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

function isOriginAllowed(origin) {
    if (allowedOrigins.includes("*")) return true;
    if (!origin) return true; // same-origin / non-browser requests (curl, mobile apps, etc.)
    return allowedOrigins.includes(origin);
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
        res.header("Access-Control-Allow-Origin", allowedOrigins.includes("*") ? "*" : origin);
    }
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// AUTH (public)
app.post("/signup", signupController.signup);
app.post("/login",  loginController.login);

// PROFILE
// Reads are public (browsing profiles/searching by skill is a core feature),
// writes require the caller to be authenticated as the profile owner.
app.post("/profile/create",          requireAuth, profile.createProfile);
app.get("/profile/search/:skill",    profile.searchBySkill); // static route before /:email
app.get("/profile/:email",           profile.getProfile);
app.put("/profile/update/:email",    requireAuth, profile.updateProfile);
app.post("/profile/add-skill",       requireAuth, profile.addSkill);
app.post("/profile/delete-skill",    requireAuth, profile.deleteSkill);
app.get("/profiles",                 profile.getAllProfiles);
app.delete("/profile/:email",        requireAuth, profile.deleteProfile);

// STARTUP & JOBS
app.use("/startup", startupRoutes);
app.use("/jobs",    jobsRoutes);

// SPA fallback
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

module.exports = { app, allowedOrigins };
