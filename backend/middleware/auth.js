const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Verifies the Bearer token on the Authorization header and attaches
 * { email, role } to req.user. Rejects the request with 401 if the
 * token is missing or invalid.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Missing or malformed authorization token" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { email: payload.email, role: payload.role };
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 * Example: router.post("/post", requireAuth, requireRole("recruiter"), ...)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You do not have permission to perform this action" });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
