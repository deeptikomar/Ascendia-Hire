const request = require("supertest");
const { createTestApp } = require("./helpers/setup");

let app;
let aliceToken, eveToken;

beforeAll(async () => {
    app = createTestApp();

    await request(app).post("/signup").send({
        name: "Alice", email: "alice@nitk.edu.in", password: "password123",
        role: "student", program: "BTech", joinYear: "2023"
    });
    await request(app).post("/signup").send({
        name: "Eve", email: "eve@nitk.edu.in", password: "password123",
        role: "student", program: "BTech", joinYear: "2023"
    });

    aliceToken = (await request(app).post("/login").send({
        email: "alice@nitk.edu.in", password: "password123"
    })).body.token;

    eveToken = (await request(app).post("/login").send({
        email: "eve@nitk.edu.in", password: "password123"
    })).body.token;
});

describe("POST /profile/create", () => {
    test("rejects when no auth token is provided", async () => {
        const res = await request(app).post("/profile/create").send({
            name: "Alice", email: "alice@nitk.edu.in", program: "BTech", joinYear: "2023"
        });
        expect(res.status).toBe(401);
    });

    test("rejects creating a profile for someone else's email", async () => {
        const res = await request(app)
            .post("/profile/create")
            .set("Authorization", `Bearer ${aliceToken}`)
            .send({ name: "Not Eve", email: "eve@nitk.edu.in", program: "BTech", joinYear: "2023" });
        expect(res.status).toBe(403);
    });

    test("creates a profile for the authenticated user", async () => {
        const res = await request(app)
            .post("/profile/create")
            .set("Authorization", `Bearer ${aliceToken}`)
            .send({ name: "Alice", email: "alice@nitk.edu.in", program: "BTech", joinYear: "2023", bio: "Hi" });
        expect(res.status).toBe(201);
    });
});

describe("GET /profile/:email", () => {
    test("is publicly readable without a token", async () => {
        const res = await request(app).get("/profile/alice@nitk.edu.in");
        expect(res.status).toBe(200);
        expect(res.body.email[0]).toBe("alice@nitk.edu.in");
    });

    test("returns 404 for a profile that doesn't exist", async () => {
        const res = await request(app).get("/profile/nobody@nitk.edu.in");
        expect(res.status).toBe(404);
    });
});

describe("skill management", () => {
    test("owner can add a skill", async () => {
        const res = await request(app)
            .post("/profile/add-skill")
            .set("Authorization", `Bearer ${aliceToken}`)
            .send({ email: "alice@nitk.edu.in", skill: "React" });
        expect(res.status).toBe(200);
    });

    test("a different user cannot add a skill to alice's profile", async () => {
        const res = await request(app)
            .post("/profile/add-skill")
            .set("Authorization", `Bearer ${eveToken}`)
            .send({ email: "alice@nitk.edu.in", skill: "Hacked" });
        expect(res.status).toBe(403);
    });

    test("adding a duplicate skill is rejected", async () => {
        const res = await request(app)
            .post("/profile/add-skill")
            .set("Authorization", `Bearer ${aliceToken}`)
            .send({ email: "alice@nitk.edu.in", skill: "react" }); // case-insensitive dupe
        expect(res.status).toBe(409);
    });

    test("owner can delete their own skill", async () => {
        const res = await request(app)
            .post("/profile/delete-skill")
            .set("Authorization", `Bearer ${aliceToken}`)
            .send({ email: "alice@nitk.edu.in", skill: "React" });
        expect(res.status).toBe(200);
    });
});

describe("DELETE /profile/:email", () => {
    test("a different user cannot delete alice's profile", async () => {
        const res = await request(app)
            .delete("/profile/alice@nitk.edu.in")
            .set("Authorization", `Bearer ${eveToken}`);
        expect(res.status).toBe(403);
    });

    test("owner can delete their own profile", async () => {
        const res = await request(app)
            .delete("/profile/alice@nitk.edu.in")
            .set("Authorization", `Bearer ${aliceToken}`);
        expect(res.status).toBe(200);

        const check = await request(app).get("/profile/alice@nitk.edu.in");
        expect(check.status).toBe(404);
    });
});
