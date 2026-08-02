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
