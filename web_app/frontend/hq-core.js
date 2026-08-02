const API_BASE = "/api/superadmin";

function showAlert(msg, type = 'success') {
    const container = document.getElementById("alert-container");
    const div = document.createElement("div");
    div.className = `alert ${type}`;
    div.innerText = msg;
    container.appendChild(div);
    setTimeout(() => { div.remove(); }, 4000);
}

async function loginHQ() {
    const email = document.getElementById("hq-email").value;
    const pwd = document.getElementById("hq-pwd").value;
    try {
        let res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pwd })
        });
        let data = await res.json();
        if (res.ok) {
            showAlert("Access Granted");
            document.getElementById("login-view").style.display = "none";
            document.getElementById("dashboard-view").style.display = "block";
            loadDashboard();
        } else {
            showAlert(data.detail, 'error');
        }
    } catch (e) {
        showAlert("Server Error", 'error');
    }
}

function logoutHQ() {
    document.getElementById("login-view").style.display = "flex";
    document.getElementById("dashboard-view").style.display = "none";
    showAlert("Logged out securely");
}

function switchTab(tabId) {
    document.querySelectorAll('.sidebar-menu li').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.section-panel').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');

    // Reload data context on tab switch
    if (tabId === 'analytics') loadAnalytics();
    else if (tabId === 'registrations') loadRegistrations();
    else if (tabId === 'updates') loadUpdates();
    else if (tabId === 'users') loadUsers();
    else if (tabId === 'queries') loadQueries();
}

function loadDashboard() {
    loadAnalytics();
}

async function loadAnalytics() {
    try {
        let res = await fetch(`${API_BASE}/analytics`);
        if (res.ok) {
            let data = await res.json();
            const a = data.analytics;
            document.getElementById('analytics-grid').innerHTML = `
                <div class="metric-card"><h3>${a.hospitals || 0}</h3><p>Hospitals</p></div>
                <div class="metric-card"><h3>${a.drivers || 0}</h3><p>Drivers</p></div>
                <div class="metric-card"><h3>${a.patients || 0}</h3><p>Patients</p></div>
                <div class="metric-card"><h3>${a.active_emergencies || 0}</h3><p>Active Emergencies</p></div>
            `;
        }
    } catch (e) { console.error(e); }
}

async function loadRegistrations() {
    try {
        let res = await fetch(`${API_BASE}/requests/hospitals`);
        let data = await res.json();
        const container = document.getElementById('registrations-list');
        if (!data.requests || data.requests.length === 0) {
            container.innerHTML = `<p style="color:#888;">No pending registrations.</p>`;
            return;
        }

        container.innerHTML = data.requests.map(r => `
            <div class="list-item">
                <div class="list-details">
                    <h4>${r.name}</h4>
                    <p><i class="fa fa-envelope"></i> ${r.support_email} | <i class="fa fa-phone"></i> ${r.contact_number}</p>
                    <p><i class="fa fa-map-marker-alt"></i> ${r.address_label || 'Location provided'}</p>
                    <p><small style="color:var(--primary)">Requested: ${r.created_at || 'Recently'}</small></p>
                </div>
                <div class="list-actions">
                    <button class="btn-approve" onclick="approveHospital(${r.id})">Approve</button>
                    <button class="btn-reject" onclick="rejectHospital(${r.id})">Reject</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function approveHospital(id) {
    if (!confirm("Are you sure you want to approve this hospital?")) return;
    try {
        let res = await fetch(`${API_BASE}/requests/hospitals/${id}/approve`, { method: 'POST' });
        if (res.ok) {
            showAlert("Hospital approved and email sent", "success");
            loadRegistrations();
        } else {
            let d = await res.json();
            showAlert(d.detail || "Error approving", "error");
        }
    } catch (e) { showAlert("Network error", "error"); }
}

async function rejectHospital(id) {
    if (!confirm("Are you sure you want to reject and DISCARD this hospital request?")) return;
    try {
        let res = await fetch(`${API_BASE}/requests/hospitals/${id}/reject`, { method: 'POST' });
        if (res.ok) {
            showAlert("Hospital registration deleted", "success");
            loadRegistrations();
        } else {
            let d = await res.json();
            showAlert(d.detail || "Error rejecting", "error");
        }
    } catch (e) { showAlert("Network error", "error"); }
}

async function loadUpdates() {
    try {
        let res = await fetch(`${API_BASE}/requests/updates`);
        let data = await res.json();
        const container = document.getElementById('updates-list');
        if (!data.requests || data.requests.length === 0) {
            container.innerHTML = `<p style="color:#888;">No pending updates.</p>`;
            return;
        }

        container.innerHTML = data.requests.map(u => `
            <div class="list-item">
                <div class="list-details">
                    <h4>${u.hospital_name}</h4>
                    <p><strong>Proposed Address:</strong> ${u.address_label} (Was: ${u.old_address})</p>
                    <p><strong>Proposed Contact:</strong> ${u.contact_number} (Was: ${u.old_contact})</p>
                </div>
                <div class="list-actions">
                    <button class="btn-approve" onclick="approveUpdate(${u.id})">Approve Update</button>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function approveUpdate(id) {
    if (!confirm("Approve these updates?")) return;
    try {
        let res = await fetch(`${API_BASE}/requests/updates/${id}/approve`, { method: 'POST' });
        if (res.ok) {
            showAlert("Update applied successfully", "success");
            loadUpdates();
        } else {
            let d = await res.json();
            showAlert(d.detail || "Error applying update", "error");
        }
    } catch (e) { showAlert("Network error", "error"); }
}

let cacheUsers = { hospitals: [], patients: [], drivers: [] };
let activeCategory = 'hospitals';

async function loadUsers() {
    try {
        let res = await fetch(`${API_BASE}/users`);
        let data = await res.json();
        cacheUsers = data.users;
        showUserCategory(activeCategory);
    } catch (e) { console.error(e); }
}

function showUserCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('[id^="btn-cat-"]').forEach(b => {
        b.style.background = '#222';
        b.style.color = '#fff';
    });
    const activeBtn = document.getElementById(`btn-cat-${cat}`);
    if (activeBtn) {
        activeBtn.style.background = 'var(--primary)';
        activeBtn.style.color = '#000';
    }

    renderUsersCategory(cat);
}

function renderUsersCategory(cat) {
    const list = cacheUsers[cat];
    const container = document.getElementById('users-list');
    if (!list || list.length === 0) {
        container.innerHTML = `<p style="color:#666; margin-top:20px;">No ${cat} found.</p>`;
        return;
    }

    let html = '<div style="margin-top:20px;">';
    list.forEach(u => {
        const isBanned = u.is_banned ? '<span style="color:var(--danger); font-weight:bold; margin-left:10px;">[BANNED]</span>' : '';
        const banBtn = u.is_banned ? '' : `<button class="btn-reject" onclick="banUser('${cat.slice(0, -1)}', ${u.id})">BAN</button>`;
        const viewBtn = `<button class="btn-approve" onclick="viewDetails('${cat.slice(0, -1)}', ${u.id})">View Details</button>`;
        html += `
            <div class="list-item">
                <div class="list-details">
                    <h4 style="${u.is_banned ? 'text-decoration:line-through; color:#555;' : ''}">${u.name} ${isBanned}</h4>
                    <p>${u.email}</p>
                </div>
                <div class="list-actions">
                    ${viewBtn}
                    ${banBtn}
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function viewDetails(type, id) {
    try {
        let res = await fetch(`${API_BASE}/users/${type}/${id}/spoof`);
        if (!res.ok) return showAlert("Failed to fetch user securely", "error");
        let data = await res.json();

        let targetFile = "";
        if (type === "hospital") {
            localStorage.setItem("adminSession", JSON.stringify(data.user));
            targetFile = "admin.html";
        } else if (type === "patient") {
            localStorage.setItem("patientSession", JSON.stringify(data.user));
            targetFile = "patient.html";
        } else if (type === "driver") {
            localStorage.setItem("driverSession", JSON.stringify(data.user));
            targetFile = "driver.html";
        }

        document.getElementById('view-iframe').src = `/static/${targetFile}?hq_view=true`;
        document.getElementById('view-modal').style.display = 'flex';
    } catch (e) { showAlert("Network error", "error"); }
}

async function banUser(type, id) {
    if (!confirm(`Are you sure you want to PERMANENTLY BAN this ${type}? This action cannot be easily undone.`)) return;
    try {
        let res = await fetch(`${API_BASE}/users/${type}/${id}/ban`, { method: 'POST' });
        if (res.ok) {
            showAlert("User banned securely and email dispatched", "success");
            loadUsers();
        } else {
            showAlert("Error banning user", "error");
        }
    } catch (e) { showAlert("Network error", "error"); }
}

let activeQueryId = null;

async function loadQueries() {
    try {
        let res = await fetch(`${API_BASE}/queries`);
        let data = await res.json();
        const pendContainer = document.getElementById('queries-list');
        const solContainer = document.getElementById('solved-queries-list');

        let pendHtml = '';
        let solHtml = '';

        data.queries.forEach(q => {
            if (q.status === 'Pending') {
                pendHtml += `
                    <div class="list-item">
                        <div class="list-details">
                            <h4>${q.name} <small style="color:var(--primary); font-size:12px;">(${q.user_type})</small></h4>
                            <p>${q.email} | ${q.contact}</p>
                            <div style="background:#0a0c10; padding:10px; border-radius:5px; margin-top:10px; border:1px solid #333;">
                                ${q.query_text}
                            </div>
                        </div>
                        <div class="list-actions">
                            <button class="btn-approve" onclick="openReplyModal(${q.id}, '${q.name.replace(/'/g, "\\'")}', '${q.email}')">Reply & Solve</button>
                        </div>
                    </div>
                `;
            } else {
                solHtml += `
                    <div class="list-item" style="border-color:var(--success);">
                        <div class="list-details">
                            <h4>${q.name}</h4>
                            <p>Query: ${q.query_text}</p>
                            <p style="color:var(--success); margin-top:5px;">Your Reply: ${q.reply_text}</p>
                        </div>
                    </div>
                `;
            }
        });

        pendContainer.innerHTML = pendHtml || "<p style='color:#666;'>No pending queries.</p>";
        solContainer.innerHTML = solHtml || "<p style='color:#666;'>No solved queries.</p>";

    } catch (e) { console.error(e); }
}

function toggleSolvedQueries() {
    const el = document.getElementById('solved-queries-wrap');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function openReplyModal(id, name, email) {
    activeQueryId = id;
    document.getElementById('reply-info').innerHTML = `Replying to: <strong>${name}</strong> (${email})`;
    document.getElementById('reply-text').value = "";
    document.getElementById('reply-modal').style.display = "flex";
}

async function sendReply() {
    const text = document.getElementById('reply-text').value;
    if (!text) return showAlert("Cannot send empty reply", "error");

    try {
        let res = await fetch(`${API_BASE}/queries/${activeQueryId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply_text: text })
        });
        if (res.ok) {
            showAlert("Reply sent and marked as solved!", "success");
            document.getElementById('reply-modal').style.display = 'none';
            loadQueries();
        } else {
            showAlert("Error replying", "error");
        }
    } catch (e) { showAlert("Network error", "error"); }
}
