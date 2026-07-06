const request = require("supertest");
const { createTestApp } = require("./helpers/setup");

let app;
let studentToken, recruiterToken, otherRecruiterToken;
let jobId;

beforeAll(async () => {
    app = createTestApp();

    await request(app).post("/signup").send({
        name: "Student", email: "student@nitk.edu.in", password: "password123",
        role: "student", program: "BTech", joinYear: "2023"
    });
    await request(app).post("/signup").send({
        name: "Recruiter", email: "recruiter@techcorp.com", password: "password123",
        role: "recruiter", company: "TechCorp"
    });
    await request(app).post("/signup").send({
        name: "Other Recruiter", email: "other@initech.com", password: "password123",
        role: "recruiter", company: "Initech"
    });

    studentToken = (await request(app).post("/login").send({
        email: "student@nitk.edu.in", password: "password123"
    })).body.token;

    recruiterToken = (await request(app).post("/login").send({
        email: "recruiter@techcorp.com", password: "password123"
    })).body.token;

    otherRecruiterToken = (await request(app).post("/login").send({
        email: "other@initech.com", password: "password123"
    })).body.token;

    // give the student a profile with one matching skill so skill-gap has
    // something real to diff against
    await request(app)
        .post("/profile/create")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ name: "Student", email: "student@nitk.edu.in", program: "BTech", joinYear: "2023" });
    await request(app)
        .post("/profile/add-skill")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ email: "student@nitk.edu.in", skill: "JavaScript" });
});

describe("POST /jobs/post", () => {
    test("rejects a student trying to post a job", async () => {
        const res = await request(app)
            .post("/jobs/post")
            .set("Authorization", `Bearer ${studentToken}`)
            .send({ title: "Intern", company: "TechCorp", skills: ["JavaScript"] });
        expect(res.status).toBe(403);
    });

    test("recruiter can post a job, attributed to their own account", async () => {
        const res = await request(app)
            .post("/jobs/post")
            .set("Authorization", `Bearer ${recruiterToken}`)
            .send({ title: "Backend Intern", company: "TechCorp", skills: ["JavaScript", "SQL"] });
        expect(res.status).toBe(201);

        const all = await request(app).get("/jobs/all");
        const job = all.body.find(j => j.title === "Backend Intern");
        expect(job.postedBy).toBe("recruiter@techcorp.com");
        jobId = job.id;
    });
});

describe("GET /jobs/all", () => {
    test("is public and includes required skills + applicant count", async () => {
        const res = await request(app).get("/jobs/all");
        expect(res.status).toBe(200);
        const job = res.body.find(j => j.id === jobId);
        expect(job.requiredSkills).toEqual(["JavaScript", "SQL"]);
        expect(job.applicantsCount).toBe(0);
    });
});

describe("POST /jobs/apply", () => {
    test("a recruiter cannot apply to their own job", async () => {
        const res = await request(app)
            .post("/jobs/apply")
            .set("Authorization", `Bearer ${recruiterToken}`)
            .send({ jobId });
        expect(res.status).toBe(400);
    });

    test("student can apply to a job", async () => {
        const res = await request(app)
            .post("/jobs/apply")
            .set("Authorization", `Bearer ${studentToken}`)
            .send({ jobId });
        expect(res.status).toBe(200);
    });

    test("applying twice is rejected", async () => {
        const res = await request(app)
            .post("/jobs/apply")
            .set("Authorization", `Bearer ${studentToken}`)
            .send({ jobId });
        expect(res.status).toBe(409);
    });
});

describe("GET /jobs/applicants/:jobId", () => {
    test("only the posting recruiter can view applicants", async () => {
        const res = await request(app)
            .get(`/jobs/applicants/${jobId}`)
            .set("Authorization", `Bearer ${otherRecruiterToken}`);
        expect(res.status).toBe(403);
    });

    test("the posting recruiter sees the applicant list", async () => {
        const res = await request(app)
            .get(`/jobs/applicants/${jobId}`)
            .set("Authorization", `Bearer ${recruiterToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toContain("student@nitk.edu.in");
    });
});

describe("GET /jobs/skill-gap/:jobId", () => {
    test("reports missing skills against the caller's profile", async () => {
        const res = await request(app)
            .get(`/jobs/skill-gap/${jobId}`)
            .set("Authorization", `Bearer ${studentToken}`);
        expect(res.status).toBe(200);
        expect(res.body.required).toEqual(["JavaScript", "SQL"]);
        expect(res.body.missing).toEqual(["SQL"]); // has JS, missing SQL
    });
});

describe("DELETE /jobs/delete/:jobId", () => {
    test("a recruiter cannot delete another recruiter's job", async () => {
        const res = await request(app)
            .delete(`/jobs/delete/${jobId}`)
            .set("Authorization", `Bearer ${otherRecruiterToken}`);
        expect(res.status).toBe(403);
    });

    test("the owning recruiter can delete their job", async () => {
        const res = await request(app)
            .delete(`/jobs/delete/${jobId}`)
            .set("Authorization", `Bearer ${recruiterToken}`);
        expect(res.status).toBe(200);
    });
});
