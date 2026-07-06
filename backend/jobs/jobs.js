const express = require("express");
const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");
const { requireAuth, requireRole } = require("../middleware/auth");
const { runExclusive } = require("../utils/fileQueue");

const router = express.Router();

const { DATA_DIR } = require("../config/paths");
const jobsFile = path.join(DATA_DIR, "jobs.xml");

const builder = new xml2js.Builder();


// ================= READ =================
function readJobs(callback) {
    fs.readFile(jobsFile, "utf8", (err, data) => {
        if (err) return callback(err);

        // If file empty
        if (!data || !data.trim()) {
            return callback(null, {
                jobs: { jobList: [{ job: [] }] }
            });
        }

        const parser = new xml2js.Parser({ explicitArray: true });

        parser.parseString(data, (err, result) => {
            // If XML broken, recover instead of crash
            if (err || !result) {
                return callback(null, {
                    jobs: { jobList: [{ job: [] }] }
                });
            }

            if (!result.jobs) result.jobs = {};
            if (!result.jobs.jobList) result.jobs.jobList = [{}];
            if (!result.jobs.jobList[0]) result.jobs.jobList[0] = {};
            if (!result.jobs.jobList[0].job)
                result.jobs.jobList[0].job = [];

            callback(null, result);
        });
    });
}


// ================= WRITE =================
function writeJobs(data, callback) {
    const xml = builder.buildObject(data);
    fs.writeFile(jobsFile, xml, callback);
}


// ================= POST JOB =================
// Only authenticated recruiters can post jobs, and the job is always
// attributed to the logged-in user (not whatever email the client sends).
router.post("/post", requireAuth, requireRole("recruiter"), (req, res) => {

    const { title, company, skills } = req.body;
    const email = req.user.email;

    if (!title || !company) {
        return res.status(400).json({ message: "Title and company are required" });
    }

    runExclusive(jobsFile, () => new Promise((resolve) => {
        readJobs((err, data) => {
            if (err) { res.status(500).json({ message: "Read error" }); return resolve(); }

            const jobs = data.jobs.jobList[0].job;

            const newJob = {
                id: [Date.now().toString()],
                title: [title],
                company: [company],
                postedBy: [email],
                requiredSkills: [{
                    skill: Array.isArray(skills) ? skills : []
                }],
                applicants: [{ applicant: [] }]
            };

            jobs.push(newJob);

            writeJobs(data, () => {
                res.status(201).json({ message: "Job posted successfully" });
                resolve();
            });
        });
    }));

});


// ================= GET ALL JOBS =================
router.get("/all", (req, res) => {

    readJobs((err, data) => {

        if (err) return res.status(500).json({ message: "Read error" });

        const jobs = data.jobs.jobList[0].job;

        const response = jobs.map(j => ({
            id: j.id[0],
            title: j.title[0],
            company: j.company[0],
            postedBy: j.postedBy[0],
            applicantsCount: j.applicants?.[0]?.applicant?.length || 0,
            requiredSkills: j.requiredSkills?.[0]?.skill || []
        }));

        res.json(response);

    });

});


// ================= APPLY JOB =================
router.post("/apply", requireAuth, (req, res) => {
  const { jobId } = req.body;
  const email = req.user.email;

  if (!jobId) return res.status(400).json({ message: "jobId is required" });

  runExclusive(jobsFile, () => new Promise((resolve) => {
    readJobs((err, data) => {
      if (err) { res.status(500).json({ message: "Read error" }); return resolve(); }
      const jobs = data.jobs.jobList[0].job;
      const job = jobs.find(j => j.id[0] === jobId);
      if (!job) { res.status(404).json({ message: "Job not found" }); return resolve(); }
      if (job.postedBy[0] === email) {
        res.status(400).json({ message: "Cannot apply to your own job" });
        return resolve();
      }

      // normalize applicants structure for <applicants/> and old XML
      if (!Array.isArray(job.applicants) || typeof job.applicants[0] !== 'object') {
        job.applicants = [{ applicant: [] }];
      }
      if (!Array.isArray(job.applicants[0].applicant)) {
        job.applicants[0].applicant = [];
      }

      const applicants = job.applicants[0].applicant.map(String);
      if (applicants.includes(email)) {
        res.status(409).json({ message: "Already applied" });
        return resolve();
      }

      job.applicants[0].applicant.push(email);
      writeJobs(data, () => {
        res.json({ message: "Applied successfully" });
        resolve();
      });
    });
  }));
});

// ================= VIEW APPLICANTS =================
// Only the recruiter who posted the job can see who applied.
router.get("/applicants/:jobId", requireAuth, (req, res) => {

    const { jobId } = req.params;
    const email = req.user.email;

    readJobs((err, data) => {
        if (err) return res.status(500).json({ message: "Read error" });

        const jobs = data.jobs.jobList[0].job;

        const job = jobs.find(j => j.id[0] === jobId);

        if (!job) return res.status(404).json({ message: "Job not found" });

        if (job.postedBy[0] !== email) {
            return res.status(403).json({ message: "Access denied" });
        }

        const applicants = job.applicants?.[0]?.applicant || [];

        res.json(applicants);

    });

});


// ================= DELETE JOB =================
router.delete("/delete/:jobId", requireAuth, (req, res) => {

    const { jobId } = req.params;
    const email = req.user.email;

    runExclusive(jobsFile, () => new Promise((resolve) => {
        readJobs((err, data) => {
            if (err) { res.status(500).json({ message: "Read error" }); return resolve(); }

            let jobs = data.jobs.jobList[0].job;

            const index = jobs.findIndex(j => j.id[0] === jobId);

            if (index === -1) { res.status(404).json({ message: "Job not found" }); return resolve(); }

            const job = jobs[index];

            if (job.postedBy[0] !== email) {
                res.status(403).json({ message: "Access denied" });
                return resolve();
            }

            jobs.splice(index, 1);

            writeJobs(data, () => {
                res.json({ message: "Deleted successfully" });
                resolve();
            });
        });
    }));

});


// ================= SEARCH JOB =================
router.get("/search/:keyword", (req, res) => {

    const keyword = req.params.keyword.toLowerCase();

    readJobs((err, data) => {
        if (err) return res.status(500).json({ message: "Read error" });

        const jobs = data.jobs.jobList[0].job;

        const result = jobs
            .filter(j =>
                j.title[0].toLowerCase().includes(keyword)
            )
            .map(j => ({
                id: j.id[0],
                title: j.title[0],
                company: j.company[0],
                postedBy: j.postedBy[0]
            }));

        res.json(result);

    });

});


// ================= MY JOBS =================
router.get("/my-jobs", requireAuth, (req, res) => {

    const email = req.user.email;

    readJobs((err, data) => {
        if (err) return res.status(500).json({ message: "Read error" });

        const jobs = data.jobs.jobList[0].job;

        const result = jobs.filter(j => j.postedBy[0] === email);

        res.json(result);

    });

});


// ================= SKILL GAP =================
router.get("/skill-gap/:jobId", requireAuth, (req, res) => {

    const { jobId } = req.params;
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

            readJobs((err, jdata) => {
                if (err) return res.status(500).json({ message: "Read error" });

                const job = jdata.jobs.jobList[0].job.find(
                    j => j.id[0] === jobId
                );

                if (!job) {
                    return res.status(404).json({ message: "Job not found" });
                }

                const required =
                    job.requiredSkills?.[0]?.skill || [];

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

// ================= MY APPLICATIONS =================
router.get("/my-applications", requireAuth, (req, res) => {
    const email = req.user.email;

    readJobs((err, data) => {
        if (err) return res.status(500).json({ message: "Read error" });

        const jobs = data.jobs.jobList[0].job || [];

        const appliedJobs = jobs
            .filter(job => {
                const applicants = job.applicants?.[0]?.applicant || [];
                return applicants.includes(email);
            })
            .map(job => ({
                id: job.id?.[0] || "",
                title: job.title?.[0] || "",
                company: job.company?.[0] || "",
                postedBy: job.postedBy?.[0] || "",
                requiredSkills: job.requiredSkills?.[0]?.skill || []
            }));

        res.json(appliedJobs);
    });
});


module.exports = router;
