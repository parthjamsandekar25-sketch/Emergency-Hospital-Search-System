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
        } else alert(data.detail || "Login failed");
    } catch (e) { alert("Error connecting"); }
}

async function doRegister() {
    const req = {
        name: document.getElementById('reg-name').value,
        admin_name: document.getElementById('reg-admin').value,
        address: document.getElementById('reg-address').value,
        contact: document.getElementById('reg-contact').value,
        userid: document.getElementById('reg-userid').value,
        pwd: document.getElementById('reg-pwd').value
    };
    if (req.pwd !== document.getElementById('reg-cpwd').value) return alert("Passwords mismatch");

    try {
        const res = await fetch('/api/admin/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req)
        });
        if (res.ok) {
            alert("Hospital Registered!");
            toggleAuth('login');
        } else {
            const data = await res.json();
            alert(data.detail || "Fail");
        }
    } catch (e) { }
}

function switchTab(tabId) {
    ['patients', 'fleet', 'rating'].forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
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
                        <h4 style="margin-bottom:0.5rem; color:var(--text-primary)">${p.patient_email} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal">(ID: ${p.booking_id})</span></h4>
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
        await fetch('/api/admin/discharge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id, treatment_id: t_id })
        });
        loadPatients();
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

// RATING SYSTEM
async function generateRatingLink() {
    const mobile = document.getElementById('rating-mobile').value;
    if (!mobile || mobile.length < 10) return alert("Valid mobile required");

    // Simulate generation to match python logic
    const link = `https://docs.google.com/forms/d/e/1FAIpQLSe_XXXX_mock_form/viewform?usp=pp_url&entry.101010=${activeAdmin.hospital_id}`;
    const url = `https://wa.me/91${mobile}?text=Thank%20you%20for%20choosing%20${activeAdmin.name.replace(' ', '%20')}!%20Please%20rate%20us:%20${encodeURIComponent(link)}`;
    window.open(url, '_blank');
}
