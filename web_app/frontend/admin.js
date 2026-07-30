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
            pendingAdminEmail = req.email;
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('otp-form').classList.remove('hidden');
        } else {
            const data = await res.json();
            alert(data.detail || "Fail");
        }
    } catch (e) { alert("Error connecting"); }
}

async function verifyAdminOTP() {
    const otp = document.getElementById('reg-otp').value;
    if (!otp) return alert("Enter OTP");
    try {
        const res = await fetch('/api/admin/verify-register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingAdminEmail, otp })
        });
        if (res.ok) {
            alert("Hospital Registered Successfully!");
            document.getElementById('otp-form').classList.add('hidden');
            toggleAuth('login');
        } else {
            const data = await res.json();
            alert(data.detail || "Invalid OTP");
        }
    } catch (e) { alert("Error"); }
}

function switchTab(tabId) {
    ['patients', 'fleet', 'management', 'account'].forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    if (event) event.target.classList.add('active');
}

function logout() {
    activeAdmin = null;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}

// PATIENT MANAGEMENT
async function loadPatients() {
    if (!activeAdmin) return;
    try {
        const res = await fetch('/api/admin/patients/' + activeAdmin.hospital_id);
        const data = await res.json();
        const container = document.getElementById('patient-list');
        if (data.patients && data.patients.length > 0) {
            let html = '';
            data.patients.forEach(p => {
                html += `
                <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="margin-bottom:0.5rem; color:var(--text-primary)">${p.patient_name || p.patient_email} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal">(ID: ${p.booking_id})</span></h4>
                        <p style="font-size:0.9rem;">Status: <strong style="color:${p.status === 'Admitted' ? '#eab308' : '#10b981'}">${p.status}</strong></p>
                    </div>
                    ${p.status === 'Admitted' ?
                        `<button class="btn btn-admin" style="width:auto;" onclick="discharge(${p.booking_id}, ${p.treatment_id})">Discharge Patient</button>` : ''}
                </div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="color:var(--text-muted)">No patients history found.</p>`;
    } catch (e) { }
}

function openOfflineAdmission() {
    document.getElementById('offline-form').classList.toggle('hidden');
}

async function submitOfflineAdmit() {
    const email = document.getElementById('off-email').value;
    const t_id = document.getElementById('off-treatment').value;
    if (!email || !t_id) return alert("Fill data");

    try {
        const res = await fetch('/api/admin/offline-admit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hospital_id: activeAdmin.hospital_id, email, treatment_id: parseInt(t_id) })
        });
        if (res.ok) {
            alert("Offline Admission Recorded");
            loadPatients();
            document.getElementById('offline-form').classList.add('hidden');
        } else alert("Failed to admit");
    } catch (e) { }
}

async function discharge(booking_id, t_id) {
    if (!confirm("Discharge patient? This will free up the bed.")) return;
    try {
        const res = await fetch('/api/admin/discharge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id, treatment_id: t_id })
        });
        if (res.ok) {
            loadPatients();
            const mobile = prompt("Patient discharged. Enter their 10-digit WhatsApp number to send the automated Firebase/Google Form feedback system. Leave blank to skip:");
            if (mobile && mobile.length >= 10) {
                // IMPORTANT: Replace the form link with actual Google Form.
                // It must have entry fields for email, booking_id, hospital_id mapped carefully.
                // Format: &entry.xxxx=val
                const link = `https://docs.google.com/forms/d/e/1FAIpQLSe_XXXX_mock_form/viewform?usp=pp_url&entry.101010=${activeAdmin.hospital_id}&entry.202020=${booking_id}`;
                const url = `https://wa.me/91${mobile}?text=Thank%20you%20for%20choosing%20${activeAdmin.name.replace(' ', '%20')}!%20Please%20rate%20us:%20${encodeURIComponent(link)}`;
                window.open(url, '_blank');
            }
        }
    } catch (e) { }
}

// FLEET MANAGEMENT
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
            alert("Account updated successfully");
            activeAdmin.address_label = address;
            activeAdmin.contact_number = contact;
            activeAdmin.latitude = parseFloat(lat);
            activeAdmin.longitude = parseFloat(lon);
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
