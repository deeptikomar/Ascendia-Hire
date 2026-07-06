const request = require("supertest");
const { createTestApp } = require("./helpers/setup");

let app;
beforeAll(() => { app = createTestApp(); });

describe("POST /signup", () => {
    test("rejects missing required fields", async () => {
        const res = await request(app).post("/signup").send({ email: "a@nitk.edu.in" });
        expect(res.status).toBe(400);
    });

    test("rejects an invalid email format", async () => {
        const res = await request(app).post("/signup").send({
            name: "A", email: "not-an-email", password: "password123",
            role: "recruiter"
        });
        expect(res.status).toBe(400);
    });

    test("rejects a password shorter than 8 characters", async () => {
        const res = await request(app).post("/signup").send({
            name: "A", email: "short@techcorp.com", password: "abc",
            role: "recruiter"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/8 characters/i);
    });

    test("rejects a student signup with a non-NITK email", async () => {
        const res = await request(app).post("/signup").send({
            name: "Student", email: "student@gmail.com", password: "password123",
            role: "student", program: "BTech", joinYear: "2024"
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/NITK email/i);
    });

    test("creates a student account with a valid NITK email", async () => {
        const res = await request(app).post("/signup").send({
            name: "Alice", email: "alice@nitk.edu.in", password: "password123",
            role: "student", program: "BTech", joinYear: "2023"
        });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe("Signup successful");
    });

    test("rejects a duplicate signup for the same email", async () => {
        const res = await request(app).post("/signup").send({
            name: "Alice Again", email: "alice@nitk.edu.in", password: "password123",
            role: "student", program: "BTech", joinYear: "2023"
        });
        expect(res.status).toBe(409);
    });

    test("creates a recruiter account with any email domain", async () => {
        const res = await request(app).post("/signup").send({
            name: "Recruiter Bob", email: "bob@techcorp.com", password: "password123",
            role: "recruiter", company: "TechCorp"
        });
        expect(res.status).toBe(201);
    });
});

describe("POST /login", () => {
    test("rejects an unknown email", async () => {
        const res = await request(app).post("/login").send({
            email: "ghost@nitk.edu.in", password: "whatever123"
        });
        expect(res.status).toBe(401);
    });

    test("rejects a correct email with the wrong password", async () => {
        const res = await request(app).post("/login").send({
            email: "alice@nitk.edu.in", password: "wrongpassword"
        });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid email or password/i);
    });

    test("logs in with correct credentials and returns a JWT", async () => {
        const res = await request(app).post("/login").send({
            email: "alice@nitk.edu.in", password: "password123"
        });
        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
        expect(res.body.role).toBe("student");

        // token should have 3 dot-separated JWT segments
        expect(res.body.token.split(".")).toHaveLength(3);
    });

    test("never returns the password field", async () => {
        const res = await request(app).post("/login").send({
            email: "alice@nitk.edu.in", password: "password123"
        });
        expect(res.body.password).toBeUndefined();
    });
});
