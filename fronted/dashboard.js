// ── Mobile sidebar ──────────────────────────────────────────────────────────────
function openSidebar()  {
    document.getElementById("appSidebar").classList.add("open");
    document.getElementById("sidebarOverlay").classList.add("open");
}
function closeSidebar() {
    document.getElementById("appSidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
}

// ── Session ──────────────────────────────────────────────────────────────────────
// Points at the same host the page was served from, so this works both
// locally (http://localhost:3000) and once deployed, without editing code.
const API      = window.location.origin;
const token    = localStorage.getItem("authToken");
const email    = localStorage.getItem("userEmail");
const role     = localStorage.getItem("userRole")     || "student";
const userName = localStorage.getItem("userName")     || "";
const company  = localStorage.getItem("userCompany")  || "";

if (!email || !token) { window.location.href = "index.html"; }

// ── Authenticated fetch helper ─────────────────────────────────────────────────
// Every API call that touches user data needs the JWT issued at login sent
// along as a Bearer token. This wraps the native fetch() so call sites below
// don't have to repeat the header, and it logs the user out automatically if
// the token is missing/expired instead of failing silently.
function authFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    return fetch(url, { ...options, headers }).then(res => {
        if (res.status === 401) {
            localStorage.clear();
            window.location.href = "index.html";
        }
        return res;
    });
}

// ── Sidebar setup ────────────────────────────────────────────────────────────────
const initials = (userName || email || "?")[0].toUpperCase();
document.getElementById("sidebarAvatar").textContent  = initials;
document.getElementById("sidebarName").textContent    = userName || email.split("@")[0];
document.getElementById("sidebarEmail").textContent   = email;

const roleBadgeColor = { student: "background:rgba(99,102,241,0.2);color:#a5b4fc", recruiter: "background:rgba(167,139,250,0.2);color:#c4b5fd" };
const roleLabel      = { student: "🎓 Student", recruiter: "🏢 Recruiter" };
const roleEl = document.getElementById("sidebarRole");
roleEl.textContent = roleLabel[role] || role;
roleEl.setAttribute("style", roleBadgeColor[role] || "");

document.getElementById("headerBadge").textContent = role === "recruiter"
    ? (company || "Recruiter")
    : (localStorage.getItem("userProgram") || "Student");
document.getElementById("headerBadge").className = `tag ${role === "recruiter" ? "bg-violet-100 text-violet-700" : ""}`;
document.getElementById("headerBadge").style.cssText = role === "recruiter"
    ? "background:#f3e8ff;color:#7e22ce"
    : "background:#eef2ff;color:#4338ca";

const studentNav = `
    <button class="nav-btn" id="nav-home"    onclick="goNav('home')">   <i class="fas fa-chart-pie"></i>Dashboard</button>
    <p class="nav-section-label">Startup Hub</p>
    <button class="nav-btn" id="nav-pitch"   onclick="goNav('pitch')">  <i class="fas fa-lightbulb"></i>Pitch My Idea</button>
    <button class="nav-btn" id="nav-explore" onclick="goNav('explore')"><i class="fas fa-search"></i>Explore Startups</button>
    <p class="nav-section-label">Opportunities</p>
    <button class="nav-btn" id="nav-jobs"    onclick="goNav('jobs')">   <i class="fas fa-briefcase"></i>Job Portal</button>
    <button class="nav-btn" id="nav-myapps"  onclick="goNav('myapps')"> <i class="fas fa-paper-plane"></i>My Applications</button>
    <p class="nav-section-label">Account</p>
    <button class="nav-btn" id="nav-profile" onclick="goNav('profile')"><i class="fas fa-user"></i>My Profile</button>`;

const recruiterNav = `
    <button class="nav-btn" id="nav-home"     onclick="goNav('home')">    <i class="fas fa-chart-pie"></i>Dashboard</button>
    <p class="nav-section-label">Jobs</p>
    <button class="nav-btn" id="nav-postjob"  onclick="goNav('postjob')"> <i class="fas fa-plus-circle"></i>Post a Job</button>
    <button class="nav-btn" id="nav-myjobs"   onclick="goNav('myjobs')">  <i class="fas fa-briefcase"></i>My Posted Jobs</button>
    <button class="nav-btn" id="nav-jobs"     onclick="goNav('jobs')">    <i class="fas fa-list"></i>All Jobs</button>
    <p class="nav-section-label">Talent</p>
    <button class="nav-btn" id="nav-explore"  onclick="goNav('explore')"> <i class="fas fa-search"></i>Browse Startups</button>
    <button class="nav-btn" id="nav-profiles" onclick="goNav('profiles')"><i class="fas fa-users"></i>Student Profiles</button>
    <p class="nav-section-label">Account</p>
    <button class="nav-btn" id="nav-profile"  onclick="goNav('profile')"> <i class="fas fa-user"></i>My Profile</button>`;

document.getElementById("sidebarNav").innerHTML = role === "recruiter" ? recruiterNav : studentNav;

// ── Toast ────────────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
    const t = document.getElementById("toast");
    t.innerHTML = `<i class="fas ${isError ? 'fa-circle-xmark' : 'fa-circle-check'}"></i> ${msg}`;
    t.style.background = isError ? "#dc2626" : "#0f172a";
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ── Logout ───────────────────────────────────────────────────────────────────────
function logout() { localStorage.clear(); window.location.href = "index.html"; }

// ── Navigation ───────────────────────────────────────────────────────────────────
const pageTitles = {
    home: "Dashboard", pitch: "Pitch My Idea", explore: "Explore Ecosystem",
    jobs: "Job Portal", myapps: "My Applications", profile: "My Profile",
    postjob: "Post a Job", myjobs: "My Posted Jobs", profiles: "Student Profiles"
};

function goNav(mod) {
    closeSidebar();
    loadModule(mod);
}

function loadModule(mod) {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    const btn = document.getElementById(`nav-${mod}`);
    if (btn) btn.classList.add("active");
    document.getElementById("pageTitle").textContent = pageTitles[mod] || "";
    const view = document.getElementById("mainView");
    // cleanup socket room when leaving startup detail
    if (_currentStartupId && mod !== "startup-detail") {
        _currentStartupId = null;
    }
    ({
        home:     () => renderHome(view),
        pitch:    () => renderPitch(view),
        explore:  () => renderExplore(view),
        jobs:     () => renderJobs(view),
        myapps:   () => renderMyApplications(view),
        profile:  () => renderProfile(view),
        postjob:  () => renderPostJob(view),
        myjobs:   () => renderMyJobs(view),
        profiles: () => renderStudentProfiles(view),
    }[mod] || (() => { view.innerHTML = `<p style="color:#94a3b8;text-align:center;margin-top:4rem">Coming soon…</p>`; }))();
}

// ── Socket.IO setup ──────────────────────────────────────────────────────────────
// The server rejects any socket connection that doesn't present a valid JWT
// (see server.js io.use(...)), so the chat can't be used to spoof another
// user's identity the way the old plain-email version could.
const socket = io({ auth: { token } });

socket.on("connect_error", (err) => {
    console.error("Socket auth failed:", err.message);
});

socket.on("newMessage", ({ author, text, ts }) => {
    const msgList = document.getElementById("msgList");
    if (!msgList) return;
    const isSelf = author === email;
    const time   = new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${isSelf ? "self" : "other"}`;
    bubble.innerHTML = `
        <div class="msg-avatar ${isSelf ? "self" : ""}">${(author[0] || "?").toUpperCase()}</div>
        <div class="msg-body ${isSelf ? "self" : ""}">
            <div class="msg-meta ${isSelf ? "self" : ""}">
                <span>${isSelf ? "You" : author.split("@")[0]}</span>
                <span>${time}</span>
            </div>
            <div class="msg-bubble-text ${isSelf ? "self" : ""}">${escHtml(text)}</div>
        </div>`;
    msgList.appendChild(bubble);
    msgList.scrollTop = msgList.scrollHeight;
});

function escHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════════════════
function renderHome(view) {
    const displayName = userName || email.split("@")[0];
    const gradYear    = parseInt(localStorage.getItem("graduationYear") || "0");
    const program     = localStorage.getItem("userProgram") || "";
    const yearsLeft   = gradYear ? Math.max(0, gradYear - new Date().getFullYear()) : "—";
    const isRec       = role === "recruiter";

    view.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem">

        <!-- Hero banner -->
        <div style="background:linear-gradient(135deg,${isRec?"#4c1d95,#1e1b4b":"#3730a3,#6d28d9"});border-radius:20px;padding:2rem;color:white;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(79,70,229,0.3)">
            <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:rgba(255,255,255,0.05);border-radius:50%"></div>
            <div style="position:absolute;bottom:-60px;right:80px;width:120px;height:120px;background:rgba(255,255,255,0.04);border-radius:50%"></div>
            <div style="position:relative">
                <p style="font-size:0.75rem;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.35rem">${isRec?"Recruiter Dashboard":"Student Dashboard"}</p>
                <h2 style="font-size:1.6rem;font-weight:800;letter-spacing:-0.03em;margin-bottom:0.25rem">Hey, ${displayName}! 👋</h2>
                <p style="color:rgba(255,255,255,0.65);font-size:0.88rem;margin-bottom:1.25rem">
                    ${isRec ? `${company ? company+" · " : ""}Post jobs and discover top student talent.` : `${program} · ${yearsLeft} year${yearsLeft!==1?"s":""} until graduation`}
                </p>
                <div style="display:flex;gap:0.65rem;flex-wrap:wrap">
                    ${isRec
                        ? `<button onclick="loadModule('postjob')" style="background:white;color:#4f46e5;border:none;padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Outfit,sans-serif">Post a Job</button>
                           <button onclick="loadModule('profiles')" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.2);padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Outfit,sans-serif">Browse Students</button>`
                        : `<button onclick="loadModule('jobs')" style="background:white;color:#4f46e5;border:none;padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Outfit,sans-serif">Browse Jobs</button>
                           <button onclick="loadModule('pitch')" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.2);padding:0.55rem 1.1rem;border-radius:10px;font-weight:700;font-size:0.82rem;cursor:pointer;font-family:Outfit,sans-serif">Pitch an Idea</button>`}
                </div>
            </div>
        </div>

        <!-- 2-col grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
            <div class="card">
                <p class="section-title"><i class="fas fa-bolt" style="color:#f59e0b;margin-right:6px"></i>Quick Actions</p>
                <div style="display:flex;flex-direction:column;gap:0.5rem">
                    ${isRec ? `
                    <button onclick="loadModule('postjob')"  class="quick-action-btn"><i class="fas fa-plus-circle" style="color:#818cf8"></i> Post a New Job</button>
                    <button onclick="loadModule('myjobs')"   class="quick-action-btn"><i class="fas fa-briefcase"   style="color:#818cf8"></i> View My Posted Jobs</button>
                    <button onclick="loadModule('profiles')" class="quick-action-btn"><i class="fas fa-users"       style="color:#34d399"></i> Browse Student Profiles</button>
                    <button onclick="loadModule('explore')"  class="quick-action-btn"><i class="fas fa-search"      style="color:#f59e0b"></i> Explore Startups</button>
                    ` : `
                    <button onclick="loadModule('profile')"  class="quick-action-btn"><i class="fas fa-user-edit"   style="color:#818cf8"></i> Update Profile & Skills</button>
                    <button onclick="loadModule('jobs')"     class="quick-action-btn"><i class="fas fa-briefcase"   style="color:#a78bfa"></i> Browse All Jobs</button>
                    <button onclick="loadModule('myapps')"   class="quick-action-btn"><i class="fas fa-paper-plane" style="color:#34d399"></i> My Applications</button>
                    <button onclick="loadModule('pitch')"    class="quick-action-btn"><i class="fas fa-lightbulb"   style="color:#f59e0b"></i> Pitch a Startup Idea</button>
                    `}
                </div>
            </div>
            <div class="card">
                <p class="section-title"><i class="fas fa-briefcase" style="color:#818cf8;margin-right:6px"></i>Latest Jobs</p>
                <div id="homeJobsList"><p style="color:#94a3b8;font-size:0.83rem">Loading…</p></div>
            </div>
        </div>
    </div>

    <style>
    .quick-action-btn {
        width:100%;display:flex;align-items:center;gap:0.65rem;padding:0.65rem 0.85rem;
        background:#f8fafc;border:1.5px solid #eef0f5;border-radius:12px;cursor:pointer;
        font-size:0.82rem;font-weight:600;color:#334155;font-family:Outfit,sans-serif;
        transition:all 0.15s;text-align:left;
    }
    .quick-action-btn:hover { background:#eef2ff;border-color:#c7d2fe;color:#4338ca; }
    @media(max-width:600px){
        .quick-action-btn { padding:0.55rem 0.7rem; }
        div[style*="grid-template-columns:1fr 1fr"] { grid-template-columns:1fr!important; }
    }
    </style>`;

    authFetch(`${API}/jobs/all`).then(r=>r.json()).then(jobs=>{
        const el = document.getElementById("homeJobsList");
        if (!jobs.length) { el.innerHTML=`<p style="color:#94a3b8;font-size:0.83rem">No jobs yet.</p>`; return; }
        el.innerHTML = jobs.slice(0,4).map(j=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0;border-bottom:1px solid #f1f5f9">
                <div>
                    <p style="font-weight:700;font-size:0.83rem;color:#0f172a">${j.title}</p>
                    <p style="font-size:0.72rem;color:#94a3b8">${j.company}</p>
                </div>
                <button class="btn-sm-outline" onclick="loadModule('jobs')">View</button>
            </div>`).join("");
    }).catch(()=>{ const el=document.getElementById("homeJobsList"); if(el) el.innerHTML=`<p style="color:#ef4444;font-size:0.83rem">Could not load.</p>`; });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
function renderProfile(view) {
    view.innerHTML = `
    <div style="max-width:700px;margin:0 auto;display:flex;flex-direction:column;gap:1.1rem">
        <div class="card" id="profileCard"><p style="color:#94a3b8;font-size:0.85rem">Loading…</p></div>
        ${role==="student"?`
        <div class="card">
            <p class="section-title"><i class="fas fa-tools" style="color:#818cf8;margin-right:6px"></i>Skills</p>
            <div id="skillsList" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem"></div>
            <div style="display:flex;gap:0.65rem">
                <input class="input-field" id="skillInput" placeholder="Add a skill (e.g. React)" style="max-width:260px" onkeydown="if(event.key==='Enter')addSkill()">
                <button class="btn btn-indigo" onclick="addSkill()"><i class="fas fa-plus"></i> Add</button>
            </div>
        </div>`:""}
        <div class="card">
            <p class="section-title"><i class="fas fa-edit" style="color:#818cf8;margin-right:6px"></i>Update Details</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.85rem;margin-bottom:1rem">
                <input class="input-field" id="profileBio"       placeholder="Bio / About">
                <input class="input-field" id="profilePhone"     placeholder="Phone">
                <input class="input-field" id="profileGithub"    placeholder="GitHub URL">
                <input class="input-field" id="profileLinkedin"  placeholder="LinkedIn URL">
                <input class="input-field" id="profilePortfolio" placeholder="Portfolio / Website URL">
            </div>
            <button class="btn btn-indigo" onclick="updateProfile()"><i class="fas fa-save"></i> Save Changes</button>
        </div>
    </div>`;
    loadProfileData();
}

async function loadProfileData() {
    try {
        const data = await (await authFetch(`${API}/profile/${email}`)).json();
        const card = document.getElementById("profileCard");
        if (!card) return;
        if (data.message === "Profile not found") {
            card.innerHTML = `<p style="color:#64748b;font-size:0.85rem;margin-bottom:1rem">No profile found. Create one to enable skill gap analysis.</p>
                <button class="btn btn-indigo" onclick="createProfile()"><i class="fas fa-plus"></i> Create Profile</button>`;
            return;
        }
        const skills = data.skills?.[0]?.skill || [];
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:1rem">
                <div style="width:52px;height:52px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:white;flex-shrink:0">
                    ${(data.name?.[0]||email)[0].toUpperCase()}
                </div>
                <div>
                    <p style="font-weight:800;font-size:1.05rem;color:#0f172a">${data.name?.[0]||"—"}</p>
                    <p style="font-size:0.78rem;color:#94a3b8">${data.email?.[0]||email}</p>
                    <p style="font-size:0.75rem;color:#64748b">${role==="student"?(data.program?.[0]||"")+" "+(data.joinYear?.[0]?`· Joined ${data.joinYear[0]}`:""):(data.company?.[0]||company||"Recruiter")}</p>
                </div>
            </div>
            ${data.bio?.[0]?`<p style="color:#475569;font-size:0.85rem;margin-top:1rem;line-height:1.65">${data.bio[0]}</p>`:""}
            <div style="display:flex;gap:0.65rem;margin-top:0.85rem;flex-wrap:wrap">
                ${data.github?.[0]   ?`<a href="${data.github[0]}"   target="_blank" style="font-size:0.75rem;color:#4f46e5;text-decoration:none;display:flex;align-items:center;gap:4px"><i class="fab fa-github"></i>GitHub</a>`:""}
                ${data.linkedin?.[0] ?`<a href="${data.linkedin[0]}" target="_blank" style="font-size:0.75rem;color:#4f46e5;text-decoration:none;display:flex;align-items:center;gap:4px"><i class="fab fa-linkedin"></i>LinkedIn</a>`:""}
                ${data.portfolio?.[0]?`<a href="${data.portfolio[0]}" target="_blank" style="font-size:0.75rem;color:#4f46e5;text-decoration:none;display:flex;align-items:center;gap:4px"><i class="fas fa-globe"></i>Portfolio</a>`:""}
            </div>`;
        ["Bio","Phone","Github","Linkedin","Portfolio"].forEach(f=>{
            const el=document.getElementById(`profile${f}`);
            if(el&&data[f.toLowerCase()]?.[0]) el.value=data[f.toLowerCase()][0];
        });
        const sl = document.getElementById("skillsList");
        if(sl) {
            sl.innerHTML = skills.length
                ? skills.map(s=>`<span style="display:inline-flex;align-items:center;gap:5px;background:#eef2ff;color:#4338ca;padding:0.25rem 0.7rem;border-radius:9999px;font-size:0.75rem;font-weight:700">
                    ${s}<button onclick="deleteSkill('${s}')" style="background:none;border:none;cursor:pointer;color:#a5b4fc;font-size:14px;line-height:1;padding:0;margin-left:2px" title="Remove">×</button></span>`).join("")
                : `<p style="color:#94a3b8;font-size:0.83rem">No skills added yet.</p>`;
        }
    } catch {
        const card=document.getElementById("profileCard");
        if(card) card.innerHTML=`<p style="color:#ef4444;font-size:0.85rem">Could not load profile — is the server running?</p>`;
    }
}

async function createProfile() {
    const payload = { name: userName||email.split("@")[0], email };
    if(role==="student") { payload.program=localStorage.getItem("userProgram")||"BTech"; payload.joinYear=localStorage.getItem("userJoinYear")||new Date().getFullYear(); }
    else { payload.company=localStorage.getItem("userCompany")||"Recruiter"; payload.role="Recruiter"; }
    const data = await (await authFetch(`${API}/profile/create`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})).json();
    toast(data.message);
    loadProfileData();
}

async function addSkill() {
    const skill = document.getElementById("skillInput").value.trim();
    if(!skill) return;
    const data = await (await authFetch(`${API}/profile/add-skill`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,skill})})).json();
    toast(data.message, data.message!=="Skill added successfully");
    document.getElementById("skillInput").value="";
    loadProfileData();
}

async function deleteSkill(skill) {
    const data = await (await authFetch(`${API}/profile/delete-skill`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,skill})})).json();
    toast(data.message);
    loadProfileData();
}

async function updateProfile() {
    const body = { bio:document.getElementById("profileBio").value, phone:document.getElementById("profilePhone").value, github:document.getElementById("profileGithub").value, linkedin:document.getElementById("profileLinkedin").value, portfolio:document.getElementById("profilePortfolio").value };
    const data = await (await authFetch(`${API}/profile/update/${email}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})).json();
    toast(data.message);
    loadProfileData();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PITCH
// ═══════════════════════════════════════════════════════════════════════════════
function renderPitch(view) {
    if(role==="recruiter"){view.innerHTML=`<p style="color:#94a3b8;text-align:center;margin-top:4rem">This section is for students.</p>`;return;}
    view.innerHTML=`
    <div style="max-width:600px;margin:0 auto">
        <div class="card">
            <p class="section-title"><i class="fas fa-lightbulb" style="color:#f59e0b;margin-right:6px"></i>Submit Your Pitch</p>
            <div style="display:flex;flex-direction:column;gap:0.85rem">
                <input class="input-field" id="pitchTitle" placeholder="Startup Name *" required>
                <textarea class="input-field" id="pitchDesc" placeholder="Describe the problem you solve…" rows="3" style="resize:none"></textarea>
                <input class="input-field" id="pitchSkills" placeholder="Required Skills (comma-separated, e.g. React, Node)">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                    <select class="input-field" id="pitchIndustry">
                        <option>Fintech</option><option>EdTech</option><option>SaaS</option><option>HealthTech</option><option>E-Commerce</option><option>Other</option>
                    </select>
                    <select class="input-field" id="pitchStage">
                        <option>Idea Stage</option><option>Prototype / MVP</option><option>Early Traction</option>
                    </select>
                </div>
                <button class="btn btn-indigo" style="padding:0.75rem;justify-content:center;font-size:0.9rem" onclick="submitPitch()">
                    <i class="fas fa-paper-plane"></i> Launch Pitch
                </button>
            </div>
        </div>
    </div>`;
}

async function submitPitch() {
    const title  = document.getElementById("pitchTitle").value.trim();
    const skills = document.getElementById("pitchSkills").value.split(",").map(s=>s.trim()).filter(Boolean);
    if(!title){toast("Startup name is required",true);return;}
    const data = await (await authFetch(`${API}/startup/post`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description:document.getElementById("pitchDesc").value.trim(),email,skills})})).json();
    toast(data.message);
    if(data.message==="Startup posted successfully") loadModule("explore");
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE STARTUPS
// ═══════════════════════════════════════════════════════════════════════════════
function renderExplore(view) {
    view.innerHTML=`
    <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
            <p class="section-title" style="margin:0">All Startups</p>
            ${role==="student"?`<button class="btn btn-indigo" onclick="loadModule('pitch')"><i class="fas fa-plus"></i> Pitch Yours</button>`:""}
        </div>
        <div id="startupGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
            <p style="color:#94a3b8;text-align:center;margin-top:3rem;grid-column:1/-1">Loading startups…</p>
        </div>
    </div>`;
    loadStartups();
}

async function loadStartups() {
    try {
        const data = await (await authFetch(`${API}/startup/all`)).json();
        const grid = document.getElementById("startupGrid");
        if(!data.length){grid.innerHTML=`<p style="color:#94a3b8;text-align:center;margin-top:3rem;grid-column:1/-1">No startups yet.</p>`;return;}
        const grads = [["#4f46e5","#7c3aed"],["#0891b2","#0e7490"],["#059669","#047857"],["#db2777","#be185d"],["#d97706","#b45309"]];
        grid.innerHTML = data.map((s,i)=>{
            const id=s.id?.[0]||"", title=s.title?.[0]||"Untitled", desc=s.description?.[0]||"";
            const creator=s.creator?.[0]||"", skills=s.requiredSkills?.[0]?.skill||[], members=s.team?.[0]?.member?.length||1;
            const isOwn=creator===email, isMember=(s.team?.[0]?.member||[]).includes(email);
            const [c1,c2]=grads[i%grads.length];
            return `
            <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
                <div style="height:80px;background:linear-gradient(135deg,${c1},${c2});padding:1rem;display:flex;align-items:flex-end">
                    <span style="background:rgba(255,255,255,0.2);color:white;padding:0.18rem 0.6rem;border-radius:9999px;font-size:0.65rem;font-weight:700;backdrop-filter:blur(6px)">${skills[0]||"Startup"}</span>
                </div>
                <div style="padding:1.1rem;flex:1;display:flex;flex-direction:column">
                    <h4 style="font-weight:800;font-size:0.92rem;margin-bottom:0.25rem;color:#0f172a">${title}</h4>
                    <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.75rem;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${desc||"No description."}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.75rem">
                        ${skills.slice(0,3).map(sk=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${sk}</span>`).join("")}
                        ${skills.length>3?`<span class="tag" style="background:#f1f5f9;color:#64748b">+${skills.length-3}</span>`:""}
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:0.75rem">
                        <span style="font-size:0.72rem;color:#94a3b8"><i class="fas fa-users" style="margin-right:4px"></i>${members} member${members!==1?"s":""}</span>
                        <div style="display:flex;gap:0.4rem;align-items:center">
                            <button class="btn-sm-outline" onclick="viewStartup('${id}')"><i class="fas fa-eye"></i> View</button>
                            ${role==="student"?`<button class="btn-sm-outline" onclick="checkStartupGap('${id}','${title}')">Skill Gap</button>`:""}
                            ${role==="student"?(isOwn?`<span class="tag" style="background:#eef2ff;color:#4338ca">Yours</span>`:isMember?`<span class="tag" style="background:#f0fdf4;color:#15803d">Member</span>`:`<button class="btn btn-slate" style="padding:0.35rem 0.75rem;font-size:0.73rem" onclick="joinStartup('${id}')">Join</button>`):""}
                        </div>
                    </div>
                </div>
            </div>`;
        }).join("");
    } catch {
        const grid=document.getElementById("startupGrid");
        if(grid) grid.innerHTML=`<p style="color:#ef4444;text-align:center;margin-top:3rem;grid-column:1/-1">Could not load startups.</p>`;
    }
}

async function joinStartup(id) {
    const data = await (await authFetch(`${API}/startup/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startupId:id,email})})).json();
    toast(data.message);
    if(data.message==="Joined startup successfully"||data.message==="Already a member") viewStartup(id);
    else loadStartups();
}

async function checkStartupGap(id, title) {
    const data = await (await authFetch(`${API}/startup/skill-gap/${id}`)).json();
    if(data.message){toast(data.message,true);return;}
    showGapModal(title,data.required,data.missing,data.userSkills);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP DETAIL + REAL-TIME CHAT
// ═══════════════════════════════════════════════════════════════════════════════
let _currentStartupId = null;

async function viewStartup(id) {
    const view = document.getElementById("mainView");
    view.innerHTML = `<p style="color:#94a3b8;text-align:center;margin-top:4rem">Loading…</p>`;
    let s;
    try {
        s = await (await authFetch(`${API}/startup/${id}`)).json();
    } catch {
        view.innerHTML = `<p style="color:#ef4444;text-align:center;margin-top:4rem">Could not load startup.</p>`;
        return;
    }
    if(s.message){toast(s.message,true);loadModule("explore");return;}
    _currentStartupId = id;
    socket.emit("joinRoom", { startupId: id });
    renderStartupDetail(s);
}

function renderStartupDetail(s) {
    const view     = document.getElementById("mainView");
    const members  = s.team?.[0]?.member || [];
    const skills   = s.requiredSkills?.[0]?.skill || [];
    const msgs     = s.messages?.[0]?.message || [];
    const title    = s.title?.[0] || "Untitled";
    const desc     = s.description?.[0] || "";
    const creator  = s.creator?.[0] || "";
    const isOwn    = creator === email;
    const isMember = members.includes(email);
    const id       = s.id?.[0] || "";

    view.innerHTML = `
    <style>
    .msg-bubble { display:flex; gap:10px; margin-bottom:12px; }
    .msg-bubble.self { flex-direction:row-reverse; }
    .msg-avatar { width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.75rem;flex-shrink:0; background:#eef2ff;color:#4338ca; }
    .msg-avatar.self { background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white; }
    .msg-body { display:flex;flex-direction:column;gap:4px;max-width:72%; }
    .msg-body.self { align-items:flex-end; }
    .msg-meta { display:flex;gap:8px;align-items:center;font-size:0.68rem;color:#94a3b8; }
    .msg-meta.self { flex-direction:row-reverse; }
    .msg-bubble-text { padding:0.55rem 0.9rem;border-radius:14px;font-size:0.83rem;line-height:1.5; background:#f1f5f9;color:#1e293b;border-radius-top-left:4px; }
    .msg-bubble-text.self { background:linear-gradient(135deg,#4f46e5,#6d28d9);color:white;border-radius-top-right:4px; }
    </style>

    <div style="max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:1rem">

        <button class="btn-sm-outline" onclick="loadModule('explore')"><i class="fas fa-arrow-left"></i> Back to Explore</button>

        <div class="card">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:0.85rem">
                <div>
                    <h2 style="font-weight:800;font-size:1.2rem;color:#0f172a;letter-spacing:-0.02em">${title}</h2>
                    <p style="font-size:0.75rem;color:#94a3b8;margin-top:2px">by ${creator}</p>
                </div>
                ${isOwn?`<span class="tag" style="background:#eef2ff;color:#4338ca;flex-shrink:0">Your startup</span>`
                    :role==="student"&&!isMember?`<button class="btn btn-slate" style="flex-shrink:0;padding:0.4rem 0.9rem;font-size:0.78rem" onclick="joinStartup('${id}')">Join</button>`
                    :isMember?`<span class="tag" style="background:#f0fdf4;color:#15803d;flex-shrink:0">✓ Member</span>`
                    :""}
            </div>
            ${desc?`<p style="font-size:0.85rem;color:#475569;margin-bottom:1rem;line-height:1.65">${desc}</p>`:""}
            ${skills.length?`
            <div style="margin-bottom:1rem">
                <p style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem">Required Skills</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.35rem">
                    ${skills.map(sk=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${sk}</span>`).join("")}
                </div>
            </div>`:""}
            <div>
                <p style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem">Team (${members.length})</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
                    ${members.map(m=>`
                    <div style="display:flex;align-items:center;gap:0.5rem;background:#f8fafc;border:1px solid #eef0f5;border-radius:10px;padding:0.4rem 0.75rem">
                        <div style="width:26px;height:26px;border-radius:7px;background:#eef2ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.7rem">${(m[0]||"?").toUpperCase()}</div>
                        <span style="font-size:0.75rem;color:#475569">${m}</span>
                        ${m===creator?`<span style="font-size:0.62rem;color:#818cf8;font-weight:700">founder</span>`:""}
                    </div>`).join("")}
                </div>
            </div>
        </div>

        <!-- LIVE CHAT -->
        <div class="card" style="display:flex;flex-direction:column;gap:0">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                <p style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;display:flex;align-items:center;gap:6px">
                    <i class="fas fa-comments"></i> Live Chat
                    <span class="live-dot"></span>
                </p>
                <span style="font-size:0.68rem;color:#94a3b8;font-family:JetBrains Mono,monospace">real-time</span>
            </div>

            <div id="msgList" style="min-height:180px;max-height:340px;overflow-y:auto;margin-bottom:1rem;padding-right:4px">
                ${msgs.length ? msgs.map(m=>{
                    const author=m.author?.[0]||"", text=m.text?.[0]||"", ts=m.ts?.[0]?new Date(Number(m.ts[0])).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";
                    const isSelf=author===email;
                    return `<div class="msg-bubble ${isSelf?"self":""}">
                        <div class="msg-avatar ${isSelf?"self":""}">${(author[0]||"?").toUpperCase()}</div>
                        <div class="msg-body ${isSelf?"self":""}">
                            <div class="msg-meta ${isSelf?"self":""}">
                                <span>${isSelf?"You":author.split("@")[0]}</span>
                                <span>${ts}</span>
                            </div>
                            <div class="msg-bubble-text ${isSelf?"self":""}">${escHtml(text)}</div>
                        </div>
                    </div>`;
                }).join("") : `<p style="color:#94a3b8;font-size:0.83rem;text-align:center;padding:2.5rem 0">No messages yet. Be the first! 👋</p>`}
            </div>

            <div style="display:flex;gap:0.65rem">
                <input id="msgInput" class="input-field" style="flex:1" placeholder="Write a message…"
                    onkeydown="if(event.key==='Enter')sendMsg('${id}')">
                <button class="btn btn-indigo" style="padding:0.6rem 1rem" onclick="sendMsg('${id}')">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    </div>`;

    const ml = document.getElementById("msgList");
    if(ml) ml.scrollTop = ml.scrollHeight;
}

function sendMsg(id) {
    const input = document.getElementById("msgInput");
    const text  = input.value.trim();
    if(!text) return;
    input.value = "";
    // author is derived server-side from the authenticated socket, not sent here
    socket.emit("sendMessage", { startupId: id, text });
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function renderJobs(view) {
    view.innerHTML=`
    <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;flex-wrap:wrap;gap:0.75rem">
            <p class="section-title" style="margin:0">All Jobs</p>
            <div style="display:flex;gap:0.65rem;align-items:center">
                <input class="input-field" id="jobSearch" placeholder="Search…" style="max-width:200px" oninput="filterJobsLocal(this.value)">
                ${role==="recruiter"?`<button class="btn btn-indigo" onclick="loadModule('postjob')"><i class="fas fa-plus"></i> Post Job</button>`:""}
            </div>
        </div>
        <div id="jobsList"><p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-top:2rem">Loading…</p></div>
    </div>`;
    loadJobs();
}

let _allJobs=[];
async function loadJobs() {
    try {
        _allJobs = await (await authFetch(`${API}/jobs/all`)).json();
        renderJobsList(_allJobs);
    } catch { const el=document.getElementById("jobsList"); if(el) el.innerHTML=`<p style="color:#ef4444;font-size:0.83rem">Could not load jobs.</p>`; }
}
function filterJobsLocal(q) {
    renderJobsList(q?_allJobs.filter(j=>j.title.toLowerCase().includes(q.toLowerCase())||j.company.toLowerCase().includes(q.toLowerCase())):_allJobs);
}
function renderJobsList(jobs) {
    const el=document.getElementById("jobsList");
    if(!jobs.length){el.innerHTML=`<p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-top:2rem">No jobs found.</p>`;return;}
    el.innerHTML=`<div style="display:flex;flex-direction:column;gap:0.75rem">`+jobs.map(j=>{
        const skills=j.requiredSkills||[], isOwn=j.postedBy===email;
        return `<div class="card" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:4px">
                    <p style="font-weight:800;color:#0f172a;font-size:0.9rem">${j.title}</p>
                    <span class="tag" style="background:#f1f5f9;color:#475569">${j.company}</span>
                    ${j.applicantsCount?`<span class="tag" style="background:#f0fdf4;color:#15803d">${j.applicantsCount} applicant${j.applicantsCount!==1?"s":""}</span>`:""}
                </div>
                <p style="font-size:0.72rem;color:#94a3b8;margin-bottom:0.5rem">Posted by: ${j.postedBy}</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
                    ${skills.map(s=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${s}</span>`).join("")}
                </div>
            </div>
            <div style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;align-items:center">
                ${role==="student"?`<button class="btn-sm-outline" onclick="checkJobGap('${j.id}','${j.title}')"><i class="fas fa-chart-bar"></i> Skill Gap</button>`:""}
                ${role==="student"&&!isOwn?`<button class="btn btn-indigo" style="padding:0.38rem 0.85rem;font-size:0.75rem" onclick="applyJob('${j.id}')"><i class="fas fa-paper-plane"></i> Apply</button>`:""}
                ${isOwn?`<button class="btn-sm-outline" onclick="viewApplicants('${j.id}','${j.title}')"><i class="fas fa-users"></i> Applicants</button>
                   <button class="btn btn-red" style="padding:0.38rem 0.75rem;font-size:0.75rem" onclick="deleteJob('${j.id}')"><i class="fas fa-trash"></i></button>`:""}
            </div>
        </div>`;
    }).join("")+`</div>`;
}

async function applyJob(id) {
    try {
        const data = await (await authFetch(`${API}/jobs/apply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:id,email})})).json();
        toast(data.message);
        if(data.message==="Applied successfully"){
            const applied=JSON.parse(localStorage.getItem("appliedJobs")||"[]");
            if(!applied.includes(id)){applied.push(id);localStorage.setItem("appliedJobs",JSON.stringify(applied));}
        }
        loadJobs();
    } catch { toast("Could not apply",true); }
}

async function deleteJob(id) {
    if(!confirm("Delete this job?")) return;
    const data = await (await authFetch(`${API}/jobs/delete/${id}`,{method:"DELETE"})).json();
    toast(data.message); loadJobs();
}

async function checkJobGap(id, title) {
    const data = await (await authFetch(`${API}/jobs/skill-gap/${id}`)).json();
    if(data.message){toast(data.message,true);return;}
    showGapModal(title,data.required,data.missing,data.userSkills);
}

async function viewApplicants(jobId, jobTitle) {
    const data = await (await authFetch(`${API}/jobs/applicants/${jobId}`)).json();
    if(data.message){toast(data.message,true);return;}
    showApplicantsModal(jobTitle,data);
}

function showApplicantsModal(title, applicants) {
    const modal=document.createElement("div");
    modal.id="applicantsModal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem";
    modal.innerHTML=`
    <div style="background:white;border-radius:20px;padding:1.75rem;max-width:460px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.2);max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
            <h3 style="font-size:1rem;font-weight:800;color:#0f172a"><i class="fas fa-users" style="color:#4f46e5;margin-right:8px"></i>Applicants: ${title}</h3>
            <button onclick="document.getElementById('applicantsModal').remove()" style="color:#94a3b8;font-size:1.3rem;background:none;border:none;cursor:pointer;line-height:1">×</button>
        </div>
        ${!applicants.length?`<p style="color:#94a3b8;text-align:center;padding:2rem 0">No applicants yet.</p>`
            :applicants.map(a=>`
            <div style="display:flex;align-items:center;gap:0.85rem;padding:0.75rem;border-radius:12px;background:#f8fafc;border:1px solid #eef0f5;margin-bottom:0.5rem">
                <div style="width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);color:#4f46e5;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;flex-shrink:0">${a[0].toUpperCase()}</div>
                <div style="flex:1;min-width:0"><p style="font-weight:700;color:#0f172a;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a}</p></div>
                <a href="mailto:${a}" style="padding:0.35rem 0.75rem;border-radius:8px;font-size:0.72rem;font-weight:700;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;white-space:nowrap"><i class="fas fa-envelope" style="margin-right:4px"></i>Contact</a>
            </div>`).join("")}
        <p style="color:#94a3b8;font-size:0.72rem;text-align:center;margin-top:0.75rem">${applicants.length} applicant${applicants.length!==1?"s":""} total</p>
        <button onclick="document.getElementById('applicantsModal').remove()" style="width:100%;margin-top:1rem;background:#0f172a;color:white;padding:0.7rem;border-radius:12px;font-weight:700;border:none;cursor:pointer;font-family:Outfit,sans-serif">Close</button>
    </div>`;
    document.body.appendChild(modal);
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST JOB
// ═══════════════════════════════════════════════════════════════════════════════
function renderPostJob(view) {
    view.innerHTML=`
    <div style="max-width:580px;margin:0 auto">
        <div class="card">
            <p class="section-title"><i class="fas fa-plus-circle" style="color:#818cf8;margin-right:6px"></i>Post a New Job</p>
            <div style="display:flex;flex-direction:column;gap:0.85rem">
                <input class="input-field" id="jobTitle" placeholder="Job Title *" required>
                <input class="input-field" id="jobCompany" placeholder="Company Name *" value="${company}" required>
                <input class="input-field" id="jobSkills" placeholder="Required Skills (comma-separated, e.g. React, Node, Python)">
                <p style="font-size:0.75rem;color:#94a3b8;font-style:italic"><i class="fas fa-info-circle" style="margin-right:4px"></i>Students can check their skill gap against this listing.</p>
                <button class="btn btn-indigo" style="padding:0.75rem;justify-content:center;font-size:0.88rem" onclick="postJob()">
                    <i class="fas fa-paper-plane"></i> Post Job
                </button>
            </div>
        </div>
    </div>`;
}

async function postJob() {
    const title=document.getElementById("jobTitle").value.trim(), comp=document.getElementById("jobCompany").value.trim();
    const skills=document.getElementById("jobSkills").value.split(",").map(s=>s.trim()).filter(Boolean);
    if(!title||!comp){toast("Title and company are required",true);return;}
    const data=await (await authFetch(`${API}/jobs/post`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,company:comp,email,skills})})).json();
    toast(data.message);
    if(data.message==="Job posted successfully") loadModule("myjobs");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY POSTED JOBS
// ═══════════════════════════════════════════════════════════════════════════════
function renderMyJobs(view) {
    view.innerHTML=`
    <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem">
            <p class="section-title" style="margin:0">My Posted Jobs</p>
            <button class="btn btn-indigo" onclick="loadModule('postjob')"><i class="fas fa-plus"></i> Post New</button>
        </div>
        <div id="myJobsList"><p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-top:2rem">Loading…</p></div>
    </div>`;
    authFetch(`${API}/jobs/my-jobs`).then(r=>r.json()).then(jobs=>{
        const el=document.getElementById("myJobsList");
        if(!el) return;
        if(!jobs.length){el.innerHTML=`<p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-top:2rem">You haven't posted any jobs yet.</p>`;return;}
        el.innerHTML=`<div style="display:flex;flex-direction:column;gap:0.75rem">`+jobs.map(j=>{
            const id=j.id?.[0]||"", title=j.title?.[0]||"", comp=j.company?.[0]||"";
            const skills=j.requiredSkills?.[0]?.skill||[], appCount=j.applicants?.[0]?.applicant?.length||0;
            return `<div class="card" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
                <div style="flex:1;min-width:180px">
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:4px">
                        <p style="font-weight:800;color:#0f172a;font-size:0.9rem">${title}</p>
                        <span class="tag" style="background:#f1f5f9;color:#475569">${comp}</span>
                        <span class="tag" style="${appCount>0?"background:#f0fdf4;color:#15803d":"background:#f1f5f9;color:#94a3b8"}">${appCount} applicant${appCount!==1?"s":""}</span>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.5rem">
                        ${skills.map(s=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${s}</span>`).join("")}
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;flex-shrink:0">
                    <button class="btn-sm-outline" onclick="viewApplicants('${id}','${title}')"><i class="fas fa-users"></i> Applicants</button>
                    <button class="btn btn-red" style="padding:0.38rem 0.75rem;font-size:0.75rem" onclick="deleteMyJob('${id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join("")+`</div>`;
    }).catch(()=>{const el=document.getElementById("myJobsList");if(el)el.innerHTML=`<p style="color:#ef4444;font-size:0.83rem">Could not load.</p>`;});
}

async function deleteMyJob(id) {
    if(!confirm("Delete this job?")) return;
    const data=await (await authFetch(`${API}/jobs/delete/${id}`,{method:"DELETE"})).json();
    toast(data.message);
    renderMyJobs(document.getElementById("mainView"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
function renderMyApplications(view) {
    view.innerHTML=`
    <div>
        <p class="section-title">My Applications</p>
        <div id="myAppsList"><p style="color:#94a3b8;font-size:0.83rem;text-align:center;margin-top:2rem">Loading…</p></div>
    </div>`;
    authFetch(`${API}/jobs/my-applications`).then(r=>r.json()).then(appliedJobs=>{
        const el=document.getElementById("myAppsList");
        if(!el) return;
        if(!appliedJobs.length){
            el.innerHTML=`<div class="card" style="text-align:center;padding:3rem 1rem">
                <i class="fas fa-paper-plane" style="font-size:2.5rem;color:#e2e8f0;margin-bottom:1rem;display:block"></i>
                <p style="font-weight:700;color:#475569">No applications yet.</p>
                <p style="color:#94a3b8;font-size:0.83rem;margin:0.5rem 0 1.25rem">Browse jobs and hit Apply to get started.</p>
                <button class="btn btn-indigo" onclick="loadModule('jobs')">Browse Jobs</button>
            </div>`;
            return;
        }
        el.innerHTML=`<div style="display:flex;flex-direction:column;gap:0.75rem">`+appliedJobs.map(j=>`
            <div class="card" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap">
                <div style="flex:1;min-width:180px">
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:4px">
                        <p style="font-weight:800;color:#0f172a;font-size:0.9rem">${j.title}</p>
                        <span class="tag" style="background:#f1f5f9;color:#475569">${j.company}</span>
                        <span class="tag" style="background:#f0fdf4;color:#15803d"><i class="fas fa-check" style="margin-right:3px"></i>Applied</span>
                    </div>
                    <p style="font-size:0.72rem;color:#94a3b8;margin-bottom:0.5rem">Posted by: ${j.postedBy}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:0.3rem">
                        ${(j.requiredSkills||[]).map(s=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${s}</span>`).join("")}
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap">
                    <button class="btn-sm-outline" onclick="checkJobGap('${j.id}','${j.title}')"><i class="fas fa-chart-bar"></i> Skill Gap</button>
                    <a href="mailto:${j.postedBy}" class="btn btn-slate" style="padding:0.38rem 0.85rem;font-size:0.75rem;text-decoration:none;display:inline-flex;align-items:center;gap:4px"><i class="fas fa-envelope"></i>Contact</a>
                </div>
            </div>`).join("")+`</div>`;
    }).catch(()=>{const el=document.getElementById("myAppsList");if(el)el.innerHTML=`<p style="color:#ef4444;font-size:0.83rem">Could not load.</p>`;});
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT PROFILES (recruiter)
// ═══════════════════════════════════════════════════════════════════════════════
function renderStudentProfiles(view) {
    view.innerHTML=`
    <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;flex-wrap:wrap;gap:0.75rem">
            <p class="section-title" style="margin:0">Student Profiles</p>
            <input class="input-field" id="profileSearch" placeholder="Search by skill or name…" style="max-width:220px" oninput="searchProfiles(this.value)">
        </div>
        <div id="profilesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1rem">
            <p style="color:#94a3b8;text-align:center;margin-top:3rem;grid-column:1/-1">Loading profiles…</p>
        </div>
    </div>`;
    loadAllProfiles();
}

let _allProfiles=[];
async function loadAllProfiles() {
    try { _allProfiles=await (await authFetch(`${API}/profiles`)).json(); renderProfilesGrid(_allProfiles); }
    catch { const g=document.getElementById("profilesGrid"); if(g) g.innerHTML=`<p style="color:#ef4444;text-align:center;margin-top:3rem;grid-column:1/-1">Could not load.</p>`; }
}
function searchProfiles(q) {
    if(!q){renderProfilesGrid(_allProfiles);return;}
    renderProfilesGrid(_allProfiles.filter(p=>{
        const skills=p.skills?.[0]?.skill||[];
        return skills.some(s=>s.toLowerCase().includes(q.toLowerCase()))||(p.name?.[0]||"").toLowerCase().includes(q.toLowerCase());
    }));
}
function renderProfilesGrid(profiles) {
    const grid=document.getElementById("profilesGrid");
    if(!profiles.length){grid.innerHTML=`<p style="color:#94a3b8;text-align:center;margin-top:3rem;grid-column:1/-1">No profiles found.</p>`;return;}
    grid.innerHTML=profiles.map(p=>{
        const skills=p.skills?.[0]?.skill||[], name=p.name?.[0]||"Unknown", pEmail=p.email?.[0]||"", prog=p.program?.[0]||"";
        return `<div class="card">
            <div style="display:flex;align-items:center;gap:0.85rem;margin-bottom:0.85rem">
                <div style="width:44px;height:44px;background:linear-gradient(135deg,#eef2ff,#e0e7ff);color:#4338ca;border-radius:13px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.1rem;flex-shrink:0">${name[0].toUpperCase()}</div>
                <div style="min-width:0">
                    <p style="font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</p>
                    <p style="font-size:0.72rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pEmail}</p>
                    ${prog?`<p style="font-size:0.72rem;color:#64748b">${prog}</p>`:""}
                </div>
            </div>
            ${p.bio?.[0]?`<p style="font-size:0.77rem;color:#475569;margin-bottom:0.75rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${p.bio[0]}</p>`:""}
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.85rem">
                ${skills.slice(0,4).map(s=>`<span class="tag" style="background:#eef2ff;color:#4338ca">${s}</span>`).join("")}
                ${skills.length>4?`<span class="tag" style="background:#f1f5f9;color:#64748b">+${skills.length-4}</span>`:""}
                ${!skills.length?`<span style="font-size:0.75rem;color:#94a3b8">No skills listed</span>`:""}
            </div>
            <div style="display:flex;gap:0.4rem;border-top:1px solid #f1f5f9;padding-top:0.75rem;flex-wrap:wrap">
                ${p.github?.[0]?`<a href="${p.github[0]}" target="_blank" class="btn-sm-outline"><i class="fab fa-github"></i> GitHub</a>`:""}
                ${p.linkedin?.[0]?`<a href="${p.linkedin[0]}" target="_blank" class="btn-sm-outline"><i class="fab fa-linkedin"></i> LinkedIn</a>`:""}
                <a href="mailto:${pEmail}" style="padding:0.38rem 0.8rem;border-radius:8px;font-size:0.72rem;font-weight:700;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-left:auto"><i class="fas fa-envelope"></i> Contact</a>
            </div>
        </div>`;
    }).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL GAP MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function showGapModal(title, required, missing, userSkills) {
    const have  = (required||[]).filter(s=>!(missing||[]).includes(s));
    const pct   = required?.length ? Math.round((have.length/required.length)*100) : 100;
    const color = pct>=70?"#10b981":pct>=40?"#f59e0b":"#ef4444";
    const bg    = pct>=70?"#f0fdf4":pct>=40?"#fffbeb":"#fef2f2";

    const modal=document.createElement("div");
    modal.id="gapModal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem";
    modal.innerHTML=`
    <div style="background:white;border-radius:22px;padding:2rem;max-width:440px;width:100%;box-shadow:0 30px 70px rgba(0,0,0,0.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
            <h3 style="font-size:1rem;font-weight:800;color:#0f172a;letter-spacing:-0.02em">Skill Gap: ${title}</h3>
            <button onclick="document.getElementById('gapModal').remove()" style="color:#94a3b8;font-size:1.3rem;background:none;border:none;cursor:pointer;line-height:1">×</button>
        </div>
        <div style="text-align:center;margin-bottom:1.5rem">
            <div style="width:88px;height:88px;border-radius:50%;border:6px solid ${color};background:${bg};display:inline-flex;align-items:center;justify-content:center;flex-direction:column">
                <span style="font-size:1.4rem;font-weight:900;color:${color};line-height:1">${pct}%</span>
                <span style="font-size:0.6rem;color:${color};font-weight:600;letter-spacing:0.05em">MATCH</span>
            </div>
        </div>
        ${(missing||[]).length?`
        <div style="margin-bottom:1rem">
            <p style="font-size:0.65rem;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.07em;margin-bottom:0.5rem">Missing (${missing.length})</p>
            <div style="display:flex;flex-wrap:wrap;gap:0.35rem">
                ${missing.map(s=>`<span style="background:#fef2f2;color:#dc2626;padding:0.2rem 0.65rem;border-radius:9999px;font-size:0.75rem;font-weight:700">${s}</span>`).join("")}
            </div>
        </div>`:""}
        ${have.length?`
        <div style="margin-bottom:0.5rem">
            <p style="font-size:0.65rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.07em;margin-bottom:0.5rem">You Have (${have.length})</p>
            <div style="display:flex;flex-wrap:wrap;gap:0.35rem">
                ${have.map(s=>`<span style="background:#f0fdf4;color:#16a34a;padding:0.2rem 0.65rem;border-radius:9999px;font-size:0.75rem;font-weight:700">${s}</span>`).join("")}
            </div>
        </div>`:""}
        ${!required?.length?`<p style="color:#94a3b8;text-align:center;font-size:0.85rem">No specific skills listed.</p>`:""}
        <button onclick="document.getElementById('gapModal').remove()" style="width:100%;margin-top:1.5rem;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:0.75rem;border-radius:12px;font-weight:700;border:none;cursor:pointer;font-family:Outfit,sans-serif;font-size:0.88rem">
            Close
        </button>
    </div>`;
    document.body.appendChild(modal);
}

// ── Boot ─────────────────────────────────────────────────────────────────────────
loadModule("home");
