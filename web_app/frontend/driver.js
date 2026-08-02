function toggleAuth(view) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');

    if (view === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.querySelector('#auth-view h2').innerText = "🚑 Driver Login";
    } else if (view === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
        document.querySelector('#auth-view h2').innerText = "🚑 Driver Registration";
    }
}

let currentDriver = null;

async function doLogin() {
    const userid = document.getElementById('login-userid').value;
    const pwd = document.getElementById('login-pwd').value;

    if (!userid || !pwd) return alert("Please enter User ID and Password.");

    try {
        const res = await fetch('/api/driver/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userid, password: pwd })
        });
        const data = await res.json();

        if (res.ok) {
            currentDriver = data.driver;
            localStorage.setItem('driverSession', JSON.stringify(currentDriver));
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('dashboard-view').classList.remove('hidden');

            document.getElementById('dash-name').innerText = currentDriver.name;
            document.getElementById('dash-hospital').innerText = currentDriver.hospital_name || 'Not Affiliated';
            updateLocalStatus(currentDriver.status);

            startLocationPings();
            pollRequests();
        } else {
            alert(data.detail || "Login failed");
        }
    } catch (e) {
        alert("Error connecting to server.");
    }
}

let pendingDriverEmail = null;

async function init_doRegister() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const contact = document.getElementById('reg-contact').value;
    const userid = document.getElementById('reg-userid').value;
    const pwd = document.getElementById('reg-pwd').value;
    const cpwd = document.getElementById('reg-cpwd').value;

    if (!name || !userid || !pwd || !email) return alert("Please fill important details");
    if (pwd !== cpwd) return alert("Passwords do not match");

    try {
        const res = await fetch('/api/driver/init-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, contact, vehicle_type: "-", vehicle_number: "-", userid, pwd })
        });
        const data = await res.json();
        if (res.ok) {
            pendingDriverEmail = email;
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('otp-form').classList.remove('hidden');
        } else {
            alert(data.detail || "Registration failed");
        }
    } catch (e) {
        alert("Error connecting to server.");
    }
}

async function verifyDriverOTP() {
    const otp = document.getElementById('reg-otp').value;
    if (!otp) return alert("Enter OTP");
    try {
        const res = await fetch('/api/driver/verify-register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingDriverEmail, otp })
        });
        if (res.ok) {
            alert("Registration Successful!");
            document.getElementById('otp-form').classList.add('hidden');
            toggleAuth('login');
        } else {
            const data = await res.json();
            alert(data.detail || "Invalid OTP");
        }
    } catch (e) { alert("Error"); }
}

async function setStatus(newStatus) {
    if (!currentDriver) return;
    try {
        const res = await fetch('/api/driver/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driver_id: currentDriver.driver_id, status: newStatus })
        });
        if (res.ok) {
            updateLocalStatus(newStatus);
        }
    } catch (e) {
        console.error("Failed to update status", e);
    }
}

function updateLocalStatus(status) {
    const badge = document.getElementById('dash-status');
    const s = status.toLowerCase();
    badge.innerText = s.charAt(0).toUpperCase() + s.slice(1);
    badge.className = 'status-badge'; // reset
    if (s === 'available') {
        badge.classList.add('online');
    } else if (s === 'busy') {
        badge.classList.add('busy');
    }
}

let locationInterval = null;
let reqInterval = null;

function startLocationPings() {
    if (locationInterval) clearInterval(locationInterval);
    if ("geolocation" in navigator) {
        locationInterval = setInterval(() => {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                if (currentDriver) {
                    try {
                        await fetch('/api/driver/update-location', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                driver_id: currentDriver.driver_id,
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude
                            })
                        });
                    } catch (e) { }
                }
            });
        }, 10000); // every 10s
    }
}

async function pollRequests() {
    if (reqInterval) clearInterval(reqInterval);
    fetchRequests();
    fetchDispatches();
    reqInterval = setInterval(() => {
        fetchRequests();
        fetchDispatches();
    }, 5000);
}

async function fetchDispatches() {
    if (!currentDriver) return;
    try {
        const res = await fetch('/api/driver/dispatch/' + currentDriver.driver_id);
        if (!res.ok) return;
        const data = await res.json();
        const disp = data.dispatch;

        if (disp) {
            document.getElementById('driver-assignments').style.display = 'block';
            document.getElementById('disp-patient').innerText = disp.patient_name;
            document.getElementById('disp-hospital').innerText = disp.hospital_name;
            document.getElementById('disp-contact').innerText = disp.contact_number;
            document.getElementById('disp-call').href = 'tel:' + disp.contact_number;

            if (currentDriver.status !== 'Busy') {
                currentDriver.status = 'Busy';
                updateLocalStatus('busy');
            }

            const locBtn = document.getElementById('disp-loc');

            if (disp.patient_lat && disp.patient_lon) {
                if (locBtn) locBtn.style.display = 'block';
                if (locBtn) locBtn.href = `https://www.google.com/maps/search/?api=1&query=${disp.patient_lat},${disp.patient_lon}`;
            } else {
                if (locBtn) locBtn.style.display = 'none';
            }

        } else {
            document.getElementById('driver-assignments').style.display = 'none';
        }
    } catch (e) { }
}

async function completeDispatch() {
    if (!currentDriver) return;
    try {
        const res = await fetch('/api/driver/dispatch/' + currentDriver.driver_id + '/complete', { method: 'POST' });
        if (res.ok) {
            document.getElementById('driver-assignments').style.display = 'none';
            updateLocalStatus('available');
        }
    } catch (e) { }
}

async function fetchRequests() {
    if (!currentDriver) return;
    try {
        const res = await fetch('/api/driver/requests/' + currentDriver.driver_id);
        const data = await res.json();
        const container = document.getElementById('driver-requests');
        if (data.requests && data.requests.length > 0) {
            let html = '';
            data.requests.forEach(r => {
                html += `
                <div style="background:#e2e8f0; padding:1rem; border-radius:8px; margin-bottom:1rem;">
                    <strong>[${r.req_type || 'Affiliation'}] from ${r.hospital_name}</strong>
                    <p style="margin:0.5rem 0; font-size:0.9rem;">Status: ${r.status}</p>
                    ${r.status === 'pending' ? `
                    <button class="btn btn-driver" style="padding:0.4rem; width:auto; border-radius:4px;" onclick="respondReq(${r.request_id}, 'accepted', ${r.hospital_id}, '${r.req_type || 'affiliation'}')">Accept</button>
                    <button class="btn" style="padding:0.4rem; width:auto; border-radius:4px; background:#ef4444;" onclick="respondReq(${r.request_id}, 'rejected', 0, '')">Reject</button>
                    ` : ''}
                </div>`;
            });
            container.innerHTML = html;
            document.getElementById('no-req-text').style.display = 'none';
        } else {
            container.innerHTML = ``;
            document.getElementById('no-req-text').style.display = 'block';
        }
    } catch (e) { console.error(e); }
}

async function respondReq(req_id, status, hosp_id, type) {
    try {
        const res = await fetch('/api/driver/respond', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_id: req_id, status, driver_id: currentDriver.driver_id, hospital_id: hosp_id, req_type: type })
        });
        const data = await res.json();
        if (res.ok) {
            fetchRequests();
            if (status === 'accepted' && data.hospital_name) {
                document.getElementById('dash-hospital').innerText = data.hospital_name;
            }
        }
    } catch (e) { alert("error responding"); }
}

function logout() {
    currentDriver = null;
    localStorage.removeItem('driverSession');
    if (locationInterval) clearInterval(locationInterval);
    if (reqInterval) clearInterval(reqInterval);
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('login-pwd').value = '';
}

window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('driverSession');
    if (saved) {
        currentDriver = JSON.parse(saved);
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');

        document.getElementById('dash-name').innerText = currentDriver.name;
        document.getElementById('dash-hospital').innerText = currentDriver.hospital_name || 'Not Affiliated';
        updateLocalStatus(currentDriver.status);

        startLocationPings();
        pollRequests();
    }
});

async function deleteDriverAccount() {
    if (!confirm("Are you entirely sure you want to delete this driver account?")) return;
    try {
        const res = await fetch(`/api/driver/profile/${currentDriver.driver_id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Driver account deleted.");
            logout();
        } else alert("Failed to delete account.");
    } catch (e) { }
}

function openQueryModal() {
    if (!currentDriver) return alert("Please login first to contact support.");
    document.getElementById('query-text').value = '';
    document.getElementById('query-modal').style.display = 'flex';
}

async function submitSupportQuery() {
    const text = document.getElementById('query-text').value;
    if (!text) return alert("Query cannot be empty");
    if (!currentDriver) return alert("Please login first.");

    const req = {
        name: currentDriver.name,
        email: currentDriver.email,
        contact: currentDriver.contact_number || "N/A",
        query_text: text
    };

    try {
        const res = await fetch('/api/driver/submit-query', {
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
