const request = require("supertest");
const { createTestApp } = require("./helpers/setup");

let app;
let creatorToken, joinerToken;
let startupId;

beforeAll(async () => {
    app = createTestApp();

    await request(app).post("/signup").send({
        name: "Creator", email: "creator@nitk.edu.in", password: "password123",
        role: "student", program: "BTech", joinYear: "2023"
    });
    await request(app).post("/signup").send({
        name: "Joiner", email: "joiner@nitk.edu.in", password: "password123",
        role: "student", program: "BTech", joinYear: "2023"
    });

    creatorToken = (await request(app).post("/login").send({
        email: "creator@nitk.edu.in", password: "password123"
    })).body.token;

    joinerToken = (await request(app).post("/login").send({
        email: "joiner@nitk.edu.in", password: "password123"
    })).body.token;

    await request(app)
        .post("/profile/create")
        .set("Authorization", `Bearer ${joinerToken}`)
        .send({ name: "Joiner", email: "joiner@nitk.edu.in", program: "BTech", joinYear: "2023" });
    await request(app)
        .post("/profile/add-skill")
        .set("Authorization", `Bearer ${joinerToken}`)
        .send({ email: "joiner@nitk.edu.in", skill: "Figma" });
});

describe("POST /startup/post", () => {
    test("requires auth", async () => {
        const res = await request(app).post("/startup/post").send({ title: "CoolApp" });
        expect(res.status).toBe(401);
    });

    test("creates a startup with the caller as creator and sole team member", async () => {
        const res = await request(app)
            .post("/startup/post")
            .set("Authorization", `Bearer ${creatorToken}`)
            .send({ title: "CoolApp", description: "An app", skills: ["React", "Figma"] });
        expect(res.status).toBe(201);

        const all = await request(app).get("/startup/all");
        const startup = all.body.find(s => s.title[0] === "CoolApp");
        expect(startup.creator[0]).toBe("creator@nitk.edu.in");
        expect(startup.team[0].member).toEqual(["creator@nitk.edu.in"]);
        startupId = startup.id[0];
    });
});

describe("POST /startup/join", () => {
    test("adds the caller to the team", async () => {
        const res = await request(app)
            .post("/startup/join")
            .set("Authorization", `Bearer ${joinerToken}`)
            .send({ startupId });
        expect(res.status).toBe(200);

        const team = await request(app).get(`/startup/team/${startupId}`);
        expect(team.body.members).toEqual(
            expect.arrayContaining(["creator@nitk.edu.in", "joiner@nitk.edu.in"])
        );
    });

    test("joining twice is rejected", async () => {
        const res = await request(app)
            .post("/startup/join")
            .set("Authorization", `Bearer ${joinerToken}`)
            .send({ startupId });
        expect(res.status).toBe(409);
    });
});

describe("GET /startup/skill-gap/:startupId", () => {
    test("reports the missing skills for the caller", async () => {
        const res = await request(app)
            .get(`/startup/skill-gap/${startupId}`)
            .set("Authorization", `Bearer ${joinerToken}`);
        expect(res.status).toBe(200);
        expect(res.body.required).toEqual(["React", "Figma"]);
        expect(res.body.missing).toEqual(["React"]); // has Figma, missing React
    });
});

describe("DELETE /startup/delete/:id", () => {
    test("a non-creator cannot delete the startup", async () => {
        const res = await request(app)
            .delete(`/startup/delete/${startupId}`)
            .set("Authorization", `Bearer ${joinerToken}`);
        expect(res.status).toBe(403);
    });

    test("the creator can delete their startup", async () => {
        const res = await request(app)
            .delete(`/startup/delete/${startupId}`)
            .set("Authorization", `Bearer ${creatorToken}`);
        expect(res.status).toBe(200);
    });
});
