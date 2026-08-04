function toggleAuth(view) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    if (view === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "⚙️ Admin Login";
    } else if (view === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "⚙️ Register Hospital";
    }
}

let activeAdmin = null;

async function doLogin() {
    const userid = document.getElementById('login-userid').value;
    const pwd = document.getElementById('login-pwd').value;
    if (!userid || !pwd) return alert("Enter credentials");
    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid, password: pwd })
        });
        const data = await res.json();
        if (res.ok) {
            activeAdmin = data.admin;
            localStorage.setItem('adminSession', JSON.stringify(activeAdmin));
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            document.getElementById('dash-name').innerText = activeAdmin.name;
            loadPatients();
            loadFleet();
            loadTreatments();
            loadAccountSettings();
        } else alert(data.detail || "Login failed");
    } catch (e) { alert("Error connecting"); }
}

let pendingAdminEmail = null;

async function init_doRegister() {
    const req = {
        name: document.getElementById('reg-name').value,
        email: document.getElementById('reg-email').value,
        address: document.getElementById('reg-address').value,
        latitude: parseFloat(document.getElementById('reg-lat').value || 0),
        longitude: parseFloat(document.getElementById('reg-lon').value || 0),
        contact: document.getElementById('reg-contact').value,
        userid: document.getElementById('reg-userid').value,
        pwd: document.getElementById('reg-pwd').value
    };
    if (!req.email || !req.name || !req.userid || !req.pwd) return alert("Fill all required fields");
    if (req.pwd !== document.getElementById('reg-cpwd').value) return alert("Passwords mismatch");

    try {
        const res = await fetch('/api/admin/init-register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req)
        });
        if (res.ok) {
            alert("Verification link sent to your email. Click 'YES' in the email to proceed with verification.");
            toggleAuth('login');
        } else {
            const data = await res.json();
            alert(data.detail || "Fail");
        }
    } catch (e) { alert("Error connecting"); }
}

function switchTab(tabId) {
    ['patients-admitted', 'patients-discharged', 'fleet', 'management', 'account'].forEach(t => {
        let el = document.getElementById('tab-' + t);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    let target = document.getElementById('tab-' + tabId);
    if (target) target.classList.remove('hidden');
    if (event && event.target) {
        // if event target has class 'tab', apply active directly
        if (event.target.classList.contains('tab')) {
            event.target.classList.add('active');
        }
    }
}

function logout() {
    activeAdmin = null;
    localStorage.removeItem('adminSession');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}

// PATIENT MANAGEMENT
async function loadPatients() {
    if (!activeAdmin) return;
    try {
        const res = await fetch('/api/admin/patients/' + activeAdmin.hospital_id);
        const data = await res.json();

        const admittedContainer = document.getElementById('patient-list-admitted');
        const dischargedContainer = document.getElementById('patient-list-discharged');

        admittedContainer.innerHTML = '';
        dischargedContainer.innerHTML = '';

        if (data.patients && data.patients.length > 0) {
            let htmlAdmitted = '';
            let htmlDischarged = '';

            data.patients.forEach(p => {
                const cardHtml = `
                <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin-bottom:0.5rem; color:var(--text-primary)">${p.patient_name || p.patient_email} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal">(ID: ${p.booking_id})</span></h4>
                        <p style="font-size:0.9rem; margin-bottom:0.25rem;">Contact: <strong>${p.contact_number || 'N/A'}</strong> | Email: <strong>${p.patient_email}</strong></p>
                        <p style="font-size:0.9rem;">Status: <strong style="color:${p.status === 'Admitted' ? '#eab308' : '#10b981'}">${p.status}</strong></p>
                    </div>
                    ${p.status === 'Admitted' ?
                        `<div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                             <button class="btn btn-admin" style="width:auto; padding:0.5rem 1rem;" onclick="discharge('${p.booking_id}', ${p.treatment_id}, '${p.contact_number || ''}')">Discharge</button>
                             <button class="btn" style="width:auto; padding:0.5rem 1rem; background:#ef4444; color:white; border:none;" onclick="removePatient('${p.booking_id}', ${p.treatment_id})">Remove</button>
                         </div>` : ''}
                </div>`;

                if (p.status === 'Admitted') {
                    htmlAdmitted += cardHtml;
                } else {
                    htmlDischarged += cardHtml;
                }
            });
            admittedContainer.innerHTML = htmlAdmitted || `<p style="color:var(--text-muted)">No active admissions.</p>`;
            dischargedContainer.innerHTML = htmlDischarged || `<p style="color:var(--text-muted)">No discharged patients.</p>`;
        } else {
            admittedContainer.innerHTML = `<p style="color:var(--text-muted)">No patients history found.</p>`;
            dischargedContainer.innerHTML = `<p style="color:var(--text-muted)">No patients history found.</p>`;
        }
    } catch (e) { }
}

function openOfflineAdmission() {
    document.getElementById('offline-form').classList.toggle('hidden');
}

async function submitOfflineAdmit() {
    const email = document.getElementById('off-email').value;
    const name = document.getElementById('off-name').value;
    const contact = document.getElementById('off-contact').value;
    const treatment = document.getElementById('off-treatment').value;
    if (!email || !treatment || !name || !contact) return alert("Fill all fields");

    let t_id = treatment;
    if (isNaN(t_id)) {
        // try finding treatment by name in global available_treatments
        const found = available_treatments.find(t => t.treatment_name.toLowerCase() === treatment.toLowerCase());
        if (found) {
            t_id = found.treatment_id;
        } else {
            return alert("Invalid treatment name");
        }
    }

    try {
        const res = await fetch('/api/admin/offline-admit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospital_id: activeAdmin.hospital_id, email, name, contact, treatment_id: parseInt(t_id) })
        });
        if (res.ok) {
            alert("Offline Admission Recorded");
            loadPatients();
            document.getElementById('offline-form').classList.add('hidden');
        } else alert("Failed to admit");
    } catch (e) { }
}

async function discharge(booking_id, t_id, contact_number) {
    if (!confirm("Discharge patient? This will free up the bed.")) return;
    try {
        const res = await fetch('/api/admin/discharge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id, treatment_id: t_id })
        });
        if (res.ok) {
            loadPatients();
            alert("Patient discharged successfully.");
        }
    } catch (e) { console.error(e); }
}

// FLEET MANAGEMENT
async function removePatient(booking_id, t_id) {
    if (!confirm("This will delete the booking entirely and release the bed. Proceed?")) return;
    try {
        const res = await fetch('/api/admin/remove-patient', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id, treatment_id: t_id })
        });
        if (res.ok) {
            loadPatients();
            alert("Booking removed successfully.");
        }
    } catch (e) { }
}

async function loadFleet() {
    if (!activeAdmin) return;
    try {
        const res = await fetch('/api/admin/fleet/' + activeAdmin.hospital_id);
        const data = await res.json();
        const container = document.getElementById('fleet-list');
        if (data.drivers && data.drivers.length > 0) {
            let html = '';
            data.drivers.forEach(d => {
                html += `
                <div class="stat-card" style="width:300px;">
                    <h4 style="color:var(--text-primary); margin-bottom:0.5rem">${d.name}</h4>
                    <p style="font-size:0.9rem">Vehicle: ${d.vehicle_type} (${d.vehicle_number})</p>
                    <p style="font-size:0.9rem">Status: <strong style="color:${d.status === 'available' ? '#10b981' : '#ef4444'}">${d.status}</strong></p>
                    <p style="font-size:0.9rem">Contact: ${d.contact_number}</p>
                </div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="color:var(--text-muted)">No drivers affiliated yet.</p>`;
    } catch (e) { }
}

async function searchAndAffiliateDriver() {
    const uid = document.getElementById('search-driver-uid').value;
    if (!uid) return alert('Enter driver UID');
    try {
        const res = await fetch('/api/admin/invite-driver', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospital_id: activeAdmin.hospital_id, driver_userid: uid })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Affiliation request dispatched to Driver Dashboard!");
        } else alert(data.detail || "Error");
    } catch (e) { }
}


// MANAGEMENT
async function loadTreatments() {
    if (!activeAdmin) return;
    try {
        const res = await fetch('/api/admin/treatments/' + activeAdmin.hospital_id);
        const data = await res.json();
        const container = document.getElementById('treatments-list');
        if (data.treatments && data.treatments.length > 0) {
            let html = '';
            data.treatments.forEach(t => {
                html += `
                <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin-bottom:0.5rem; color:var(--text-primary)">${t.treatment_name}</h4>
                        <p style="font-size:0.9rem;">Cost: <strong>₹${t.cost}</strong> | Total Beds: <strong>${t.available_beds}</strong></p>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <input type="number" id="upd-cost-${t.treatment_id}" value="${t.cost}" style="width:80px; padding:0.25rem;">
                        <input type="number" id="upd-beds-${t.treatment_id}" value="${t.available_beds}" style="width:80px; padding:0.25rem;">
                        <button class="btn btn-admin" style="padding:0.25rem 0.5rem;" onclick="updateTreatment(${t.treatment_id})">Update</button>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:var(--text-muted)">No treatments added yet.</p>`;
        }
    } catch (e) { }
}

async function addTreatment() {
    const name = document.getElementById('treat-name').value;
    const cost = document.getElementById('treat-cost').value;
    const beds = document.getElementById('treat-beds').value;
    if (!name || !cost || !beds) return alert("Fill all treatment fields");

    try {
        const res = await fetch('/api/admin/treatments', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospital_id: activeAdmin.hospital_id, treatment_name: name, cost: parseInt(cost), available_beds: parseInt(beds) })
        });
        if (res.ok) {
            alert("Treatment added");
            loadTreatments();
        } else alert("Failed to add treatment");
    } catch (e) { }
}

async function updateTreatment(t_id) {
    const cost = document.getElementById(`upd-cost-${t_id}`).value;
    const beds = document.getElementById(`upd-beds-${t_id}`).value;
    try {
        const res = await fetch(`/api/admin/treatments/${t_id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cost: parseInt(cost), available_beds: parseInt(beds) })
        });
        if (res.ok) {
            alert("Treatment updated");
            loadTreatments();
        } else alert("Failed to update");
    } catch (e) { }
}

// ACCOUNT
function loadAccountSettings() {
    if (!activeAdmin) return;
    document.getElementById('acc-address').value = activeAdmin.address_label || '';
    document.getElementById('acc-contact').value = activeAdmin.contact_number || '';
    document.getElementById('acc-lat').value = activeAdmin.latitude || '';
    document.getElementById('acc-lon').value = activeAdmin.longitude || '';
}

async function updateHospitalAccount() {
    const address = document.getElementById('acc-address').value;
    const contact = document.getElementById('acc-contact').value;
    const lat = document.getElementById('acc-lat').value;
    const lon = document.getElementById('acc-lon').value;

    try {
        const res = await fetch('/api/admin/profile', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hospital_id: activeAdmin.hospital_id,
                address_label: address,
                contact_number: contact,
                latitude: parseFloat(lat),
                longitude: parseFloat(lon)
            })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Account update request sent to System Administrator for approval!");
        } else alert(data.detail || "Update failed");
    } catch (e) { }
}

async function deleteHospitalAccount() {
    if (!confirm("Are you absolutely sure you want to delete this hospital account? This action cannot be undone.")) return;
    try {
        const res = await fetch(`/api/admin/profile/${activeAdmin.hospital_id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Hospital account deleted.");
            logout();
        } else alert("Failed to delete account.");
    } catch (e) { }
}

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('adminSession');
    if (saved) {
        activeAdmin = JSON.parse(saved);
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('dash-name').innerText = activeAdmin.name;
        loadPatients();
        loadFleet();
        loadTreatments();
    }
});

function openQueryModal() {
    if (!activeAdmin) return alert("Please login first to contact support.");
    document.getElementById('query-text').value = '';
    document.getElementById('query-modal').style.display = 'flex';
}

async function submitSupportQuery() {
    const text = document.getElementById('query-text').value;
    if (!text) return alert("Query cannot be empty");
    if (!activeAdmin) return alert("Please login first.");

    const req = {
        name: activeAdmin.name || "Hospital",
        email: activeAdmin.support_email || "support@hospital",
        contact: activeAdmin.contact_number || "N/A",
        query_text: text
    };

    try {
        const res = await fetch('/api/admin/submit-query', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req)
        });
        if (res.ok) {
            alert("Query sent to System HQ successfully!");
            document.getElementById('query-modal').style.display = 'none';
        } else {
            const data = await res.json();
            alert(data.detail || "Error sending query");
        }
    } catch (e) { alert("Network error"); }
}

if (new URLSearchParams(window.location.search).get('hq_view') === 'true') {
    const style = document.createElement('style');
    style.innerHTML = "input, select, textarea, button:not(.tab) { pointer-events: none !important; opacity: 0.6 !important; filter: grayscale(1); } a.btn, a[href] { pointer-events: none !important; } .sidebar-menu li { pointer-events: auto !important; opacity: 1 !important; filter: none !important; }";
    document.head.appendChild(style);
}

let currentForgotEmail = "";

function openForgotPwdModal() {
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-userid').value = '';
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-pwd-modal').style.display = 'flex';
}

async function sendForgotOTP() {
    const userid = document.getElementById('forgot-userid').value;
    const email = document.getElementById('forgot-email').value;
    if (!userid && !email) return alert("Please enter User ID or Email");

    try {
        const res = await fetch('/api/admin/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid: userid, email: email })
        });
        const data = await res.json();
        if (res.ok) {
            currentForgotEmail = data.email;
            document.getElementById('forgot-email-masked').innerText = `OTP sent to ${data.email_masked}`;
            document.getElementById('forgot-step-1').style.display = 'none';
            document.getElementById('forgot-step-2').style.display = 'block';
        } else {
            alert(data.detail || "User not found.");
        }
    } catch (e) { alert("Network error"); }
}

async function submitNewPassword() {
    const otp = document.getElementById('forgot-otp').value;
    const pwd1 = document.getElementById('forgot-new-pwd').value;
    const pwd2 = document.getElementById('forgot-confirm-pwd').value;
    
    if (!otp || !pwd1) return alert("Please fill all fields");
    if (pwd1 !== pwd2) return alert("Passwords do not match");

    try {
        const res = await fetch('/api/admin/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentForgotEmail, otp: otp, new_password: pwd1 })
        });
        if (res.ok) {
            alert("Password updated successfully! You can now login.");
            document.getElementById('forgot-pwd-modal').style.display = 'none';
        } else {
            const data = await res.json();
            alert(data.detail || "Failed to reset password.");
        }
    } catch (e) { alert("Network error"); }
}
