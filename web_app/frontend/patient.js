// Patient Frontend Complete Logic
function toggleAuth(view) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('otp-form').classList.add('hidden');

    if (view === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "🩺 Patient Login";
    } else if (view === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "🩺 Patient Registration";
    } else if (view === 'otp') {
        document.getElementById('otp-form').classList.remove('hidden');
        document.getElementById('auth-title').innerText = "🩺 Email Verification";
    }
}

let pendingEmail = "";
let currentUser = null;

async function doLogin() {
    const userid = document.getElementById('login-userid').value;
    const pwd = document.getElementById('login-pwd').value;
    if (!userid || !pwd) return alert("Please enter User ID and Password.");

    try {
        const res = await fetch('/api/patient/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid, password: pwd })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');
            document.getElementById('dash-name').innerText = currentUser.name;
            loadMedicalHistory();
            loadFamily();
        } else {
            alert(data.detail || "Login failed");
        }
    } catch (e) {
        alert("Error connecting to server.");
    }
}

async function doRegister() {
    const d = {
        name: document.getElementById('reg-name').value,
        dob: document.getElementById('reg-dob').value,
        gender: document.getElementById('reg-gender').value,
        blood: document.getElementById('reg-blood').value,
        contact: document.getElementById('reg-contact').value,
        email: document.getElementById('reg-email').value,
        address: document.getElementById('reg-address').value,
        allergies: document.getElementById('reg-allergies').value,
        userid: document.getElementById('reg-userid').value,
        pwd: document.getElementById('reg-pwd').value,
    };
    const cpwd = document.getElementById('reg-cpwd').value;

    if (!d.name || !d.dob || !d.email || !d.userid || !d.pwd) return alert("Please fill required details");
    if (d.pwd !== cpwd) return alert("Passwords do not match");

    try {
        const res = await fetch('/api/patient/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d)
        });
        const data = await res.json();
        if (res.ok) {
            pendingEmail = d.email;
            alert("OTP Sent to Email!");
            toggleAuth('otp');
        } else alert(data.detail || "Registration failed");
    } catch (e) { alert("Error connecting to server."); }
}

async function verifyOTP() {
    const otp = document.getElementById('verify-otp').value;
    if (!otp) return alert("Enter OTP");

    try {
        const res = await fetch('/api/patient/verify-otp', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingEmail, otp })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Registration Successful!");
            toggleAuth('login');
        } else alert(data.detail || "Invalid OTP");
    } catch (e) { alert("Error connecting to server."); }
}

function switchTab(tabId) {
    ['emergency', 'medical', 'family', 'account'].forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    if (event) event.target.classList.add('active');
}

function logout() {
    currentUser = null;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('login-pwd').value = '';
}

async function searchHospitals() {
    const treatment = document.getElementById('srch-treatment').value;
    const sort_by = document.getElementById('srch-sort').value;
    if (!treatment) return alert("Please enter a treatment");

    const container = document.getElementById('search-results');
    container.innerHTML = "<p>Retrieving your location for accurate distances...</p>";

    let lat = null;
    let lon = null;

    if ("geolocation" in navigator) {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
        } catch (err) {
            console.warn("Geolocation blocked or failed. Using default location (Mumbai).");
        }
    }

    container.innerHTML = "<p>Searching hospitals...</p>";

    try {
        const res = await fetch('/api/patient/emergency-search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ treatment, sort_by, lat, lon })
        });
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            let html = '';
            data.results.forEach(h => {
                html += `
                <div class="h-card">
                    <h4 style="color:var(--color-patient)">${h.name}</h4>
                    <p style="font-size:0.9rem; margin:0.5rem 0;">Distance: <strong>${h.distance_km.toFixed(1)} km</strong> | Cost: ₹${h.cost} | Rating: ${h.avg_rating > 0 ? h.avg_rating.toFixed(1) : 'New'}</p>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">Beds: ${h.available_beds} | Contact: ${h.contact_number} | ${h.address_label}</p>
                    <button class="btn btn-patient" style="padding: 0.5rem 1rem;" onclick="bookBed(${h.hospital_id}, ${h.treatment_id}, '${h.name}')">Book Bed</button>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:var(--text-muted)">No hospitals found for '${treatment}'.</p>`;
        }
    } catch (e) { container.innerHTML = "<p>Error loading hospitals.</p>"; }
}

async function bookBed(hospital_id, treatment_id, hospital_name) {
    if (!confirm('Book bed at ' + hospital_name + '?')) return;
    try {
        const res = await fetch('/api/patient/book-bed', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, name: currentUser.name, hospital_id, treatment_id })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Bed officially booked! An ambulance will be coordinated shortly.");
            loadMedicalHistory();
            if (data.wa_link) window.open(data.wa_link, '_blank');
        } else alert(data.detail || "Booking failed.");
    } catch (e) { alert("Communication error."); }
}

async function loadMedicalHistory() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/patient/history/' + currentUser.email);
        const data = await res.json();
        const container = document.getElementById('history-results');
        if (data.bookings && data.bookings.length > 0) {
            let html = ``;
            data.bookings.forEach(b => {
                let col = b.status === 'Discharged' ? '#10B981' : '#F59E0B';
                html += `
                <div class="h-card" style="display:flex; justify-content:space-between;">
                    <div><h4 style="color:var(--color-patient)">${b.hospital_name}</h4><p style="font-size:0.9rem; margin-top:0.5rem">Treatment: ${b.treatment_name || 'N/A'}</p></div>
                    <div style="text-align:right"><span style="font-weight:bold; color:${col}">• ${b.status}</span><p style="font-size:0.8rem; margin-top:0.5rem;">Id: ${b.booking_id}</p></div>
                </div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="color:var(--text-muted)">No past records found.</p>`;
    } catch (e) { console.error(e); }
}

async function loadFamily() {
    try {
        const res = await fetch('/api/patient/family/' + currentUser.patient_id);
        const data = await res.json();
        const container = document.getElementById('family-results');
        if (data.family && data.family.length > 0) {
            let html = '';
            data.family.forEach(f => {
                html += `<div class="h-card" style="width:250px;">
                    <h4 style="margin-bottom:0.5rem;">${f.member_name}</h4>
                    <p style="font-size:0.9rem; color:var(--text-muted)">Relation: ${f.relation}</p>
                    <p style="font-size:0.9rem; color:var(--text-muted)">DOB: ${f.dob}</p>
                    <button class="btn" style="background:#ef4444; margin-top:1rem; padding:0.4rem;" onclick="delFamily(${f.member_id})">Delete</button>
                </div>`;
            });
            container.innerHTML = html;
        } else container.innerHTML = `<p style="color:var(--text-muted)">No family members added.</p>`;
    } catch (e) { console.error(e); }
}

async function addFamily() {
    const name = document.getElementById('fam-name').value;
    const relation = document.getElementById('fam-rel').value;
    const dob = document.getElementById('fam-dob').value;
    if (!name || !relation || !dob) return alert("Fill all family fields.");
    try {
        const res = await fetch('/api/patient/family', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: currentUser.patient_id, name, relation, dob })
        });
        if (res.ok) {
            alert("Added successfully.");
            loadFamily();
        } else alert("Failed to add.");
    } catch (e) { alert("Error."); }
}

async function delFamily(member_id) {
    if (!confirm("Are you sure?")) return;
    try {
        const res = await fetch('/api/patient/family/' + member_id, { method: 'DELETE' });
        if (res.ok) loadFamily();
    } catch (e) { console.error(e); }
}

async function updateAccount() {
    const cur_pwd = document.getElementById('acc-pwd').value;
    const new_uid = document.getElementById('acc-newuid').value;
    const new_pwd = document.getElementById('acc-newpwd').value;
    if (!cur_pwd) return alert("Current password is required.");
    try {
        const res = await fetch('/api/patient/update-account', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: currentUser.patient_id, cur_pwd, new_uid, new_pwd })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Account updated successfully.");
            currentUser = data.user;
        } else alert(data.detail || "Update failed.");
    } catch (e) { alert("Error communicating with server."); }
}
