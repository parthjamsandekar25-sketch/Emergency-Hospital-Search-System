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
            localStorage.setItem('patientSession', JSON.stringify(currentUser));
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

    if (tabId === 'account' && currentUser) {
        document.getElementById('acc-contact').value = currentUser.contact_number || '';
        document.getElementById('acc-address').value = currentUser.address || '';
        document.getElementById('acc-allergies').value = currentUser.known_allergies || '';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('patientSession');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('login-pwd').value = '';
}

let currentLat = null;
let currentLon = null;

async function searchHospitals() {
    const treatment = document.getElementById('srch-treatment').value;
    const sort_by = document.getElementById('srch-sort').value;
    if (!treatment) return alert("Please enter a treatment");

    const container = document.getElementById('search-results');
    container.innerHTML = "<p>Retrieving your location for accurate distances...</p>";

    if ("geolocation" in navigator) {
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            currentLat = pos.coords.latitude;
            currentLon = pos.coords.longitude;
        } catch (err) {
            console.warn("Geolocation blocked or failed. Using default location (Mumbai).");
        }
    }

    container.innerHTML = "<p>Searching hospitals...</p>";

    try {
        const res = await fetch('/api/patient/emergency-search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ treatment, sort_by, lat: currentLat, lon: currentLon })
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
                    <div style="margin-bottom:0.75rem; display:flex; align-items:center;">
                        <input type="checkbox" id="req-amb-${h.hospital_id}" style="accent-color:var(--color-patient); width:1.2rem; height:1.2rem; margin-right:0.5rem; cursor:pointer;">
                        <label for="req-amb-${h.hospital_id}" style="font-size:0.9rem; cursor:pointer;" title="If checked, we will dispatch an ambulance if one is available.">Request Ambulance Trip</label>
                    </div>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
                        <button class="btn btn-patient" style="flex:1; min-width:100px; padding: 0.5rem;" onclick="bookBed(${h.hospital_id}, ${h.treatment_id}, '${h.name}')">Book Bed</button>
                        <button class="btn" style="flex:1; min-width:100px; padding: 0.5rem; background:#3b82f6; color:white;" onclick="viewReviews(${h.hospital_id}, '${h.name.replace(/'/g, "\\'")}')">View Reviews</button>
                        <a href="tel:${h.contact_number}" class="btn" style="flex:1; min-width:100px; padding: 0.5rem; text-align:center; background:#10B981; color:white; text-decoration:none;">Call Hospital</a>
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p style="color:var(--text-muted)">No hospitals found for '${treatment}'.</p>`;
        }
    } catch (e) { container.innerHTML = "<p>Error loading hospitals.</p>"; }
}

async function bookBed(hospital_id, treatment_id) {
    if (!confirm("Confirm bed booking?")) return;
    try {
        const whom = document.getElementById('srch-whom').value;
        const patientName = whom === 'self' ? currentUser.name : whom;

        let reqAmb = false;
        const ambCheck = document.getElementById('req-amb-' + hospital_id);
        if (ambCheck) reqAmb = ambCheck.checked;

        const res = await fetch('/api/patient/book-bed', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                name: patientName,
                hospital_id,
                treatment_id,
                requires_ambulance: reqAmb,
                patient_lat: currentLat,
                patient_lon: currentLon
            })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('bs-hospital-name').innerText = document.getElementById('srch-treatment').value + " at " + (arguments[2] || "Hospital");

            if (data.driver) {
                document.getElementById('bs-no-driver').style.display = 'none';
                document.getElementById('bs-driver-info').style.display = 'block';
                document.getElementById('bs-driver-name').innerText = data.driver.name;
                document.getElementById('bs-driver-call').href = 'tel:' + data.driver.contact_number;
            } else {
                document.getElementById('bs-driver-info').style.display = 'none';
                document.getElementById('bs-no-driver').style.display = 'block';
                document.getElementById('bs-no-driver').innerText = "Currently no ambulances available at this hospital.";
            }

            document.getElementById('booking-success-modal').style.display = 'flex';
            loadMedicalHistory();
        } else alert(data.detail || "Booking failed.");
    } catch (e) { alert("Communication error."); }
}

function closeBookingSuccess() {
    document.getElementById('booking-success-modal').style.display = 'none';
    switchTab('medical');
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

                let rateBtnHtml = '';
                if (b.status === 'Discharged') {
                    if (b.is_rated) {
                        rateBtnHtml = `<button class="btn" style="padding:0.25rem 0.5rem; background:#e2e8f0; font-size:0.8rem; margin-top:0.5rem; width:100%;" onclick="viewMyRating('${b.booking_id}', '${b.hospital_name}')">View My Rating</button>`;
                    } else {
                        rateBtnHtml = `<button class="btn btn-patient" style="padding:0.25rem 0.5rem; font-size:0.8rem; margin-top:0.5rem; width:100%;" onclick="openRateModal('${b.booking_id}', ${b.hospital_id}, '${b.hospital_name.replace(/'/g, "\\'")}')">Rate Treatment</button>`;
                    }
                }

                html += `
                <div class="h-card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><h4 style="color:var(--color-patient)">${b.hospital_name}</h4><p style="font-size:0.9rem; margin-top:0.5rem">Treatment: ${b.treatment_name || 'N/A'}</p></div>
                    <div style="text-align:right;">
                        <span style="font-weight:bold; color:${col}">• ${b.status}</span>
                        <p style="font-size:0.8rem; margin-top:0.25rem;">Id: ${b.booking_id}</p>
                        ${rateBtnHtml}
                    </div>
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
        const list = document.getElementById('family-results');
        const whomDropdown = document.getElementById('fam-dropdown');
        if (data.family && data.family.length > 0) {
            let html = '';
            let optHtml = '<option value="self">Myself</option>';
            data.family.forEach(f => {
                html += `<div class="h-card" style="width:250px;">
                    <h4 style="margin-bottom:0.5rem;">${f.member_name}</h4>
                    <p style="font-size:0.9rem; color:var(--text-muted)">Relation: ${f.relation}</p>
                    <p style="font-size:0.9rem; color:var(--text-muted)">DOB: ${f.dob}</p>
                    <button class="btn" style="background:#ef4444; margin-top:1rem; padding:0.4rem;" onclick="delFamily(${f.member_id})">Delete</button>
                </div>`;
                optHtml += `<option value="${f.member_name}">${f.member_name} (${f.relation})</option>`;
            });
            list.innerHTML = html;
            whomDropdown.innerHTML = optHtml;
        } else {
            list.innerHTML = `<p style="color:var(--text-muted)">No family members added.</p>`;
            whomDropdown.innerHTML = '';
        }
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
    const contact = document.getElementById('acc-contact').value;
    const address = document.getElementById('acc-address').value;
    const allergies = document.getElementById('acc-allergies').value;

    if (!cur_pwd) return alert("Current password is required.");
    try {
        const res = await fetch('/api/patient/update-account', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patient_id: currentUser.patient_id, cur_pwd, new_uid, new_pwd, contact, address, allergies })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Account updated successfully.");
            currentUser = data.user;
        } else alert(data.detail || "Update failed.");
    } catch (e) { alert("Error communicating with server."); }
}

async function viewReviews(hospital_id, hospital_name) {
    document.getElementById('rm-title').innerText = `${hospital_name} - Patient Reviews`;
    const c = document.getElementById('rm-content');
    c.innerHTML = "<em>Loading reviews...</em>";
    document.getElementById('reviews-modal').style.display = 'flex';

    try {
        const res = await fetch(`/api/patient/reviews/${hospital_id}`);
        const data = await res.json();
        if (data.reviews && data.reviews.length > 0) {
            c.innerHTML = data.reviews.map(r => `
                <div style="border-bottom:1px solid var(--border); padding-bottom:0.5rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                        <strong>Rating: ${r.overall_rating} ★</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${r.date_submitted}</span>
                    </div>
                    <p style="font-size:0.9rem; margin:0; line-height:1.4;">"${r.written_review}"</p>
                </div>
            `).join('');
        } else {
            c.innerHTML = "<p>No written reviews available for this hospital yet.</p>";
        }
    } catch (e) {
        c.innerHTML = "<p style='color:red;'>Failed to load reviews.</p>";
    }
}

async function deletePatientAccount() {
    if (!confirm("Are you entirely sure you want to delete your account? This will erase all medical history.")) return;
    try {
        const res = await fetch(`/api/patient/profile/${currentUser.patient_id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("Account deleted.");
            logout();
        } else alert("Failed to delete account.");
    } catch (e) { }
}

function openRateModal(booking_id, hospital_id, hospital_name) {
    document.getElementById('rate-booking-id').value = booking_id;
    document.getElementById('rate-hospital-id').value = hospital_id;
    document.getElementById('rate-hospital-name').innerText = hospital_name;

    document.querySelectorAll('.star-rating').forEach(group => {
        group.setAttribute('data-value', '5');
        group.querySelectorAll('.star').forEach(s => s.classList.add('active'));
    });

    document.getElementById('rate-text').value = '';

    document.getElementById('rate-modal').style.display = 'flex';
}

async function submitRating() {
    const booking_id = document.getElementById('rate-booking-id').value;
    const hospital_id = parseInt(document.getElementById('rate-hospital-id').value);

    const doctor_care = parseInt(document.querySelector('.star-rating[data-id="rate-doctor"]').getAttribute('data-value'));
    const hygiene = parseInt(document.querySelector('.star-rating[data-id="rate-hygiene"]').getAttribute('data-value'));
    const staff_behavior = parseInt(document.querySelector('.star-rating[data-id="rate-staff"]').getAttribute('data-value'));
    const facilities = parseInt(document.querySelector('.star-rating[data-id="rate-facilities"]').getAttribute('data-value'));
    const speed_of_service = parseInt(document.querySelector('.star-rating[data-id="rate-speed"]').getAttribute('data-value'));

    const review_text = document.getElementById('rate-text').value;

    document.getElementById('rate-submit-btn').disabled = true;
    document.getElementById('rate-submit-btn').innerText = "Submitting...";

    try {
        const res = await fetch('/api/patient/rate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking_id, hospital_id, doctor_care, hygiene, staff_behavior, facilities, speed_of_service, review_text })
        });

        if (res.ok) {
            alert("Thank you for your rating!");
            document.getElementById('rate-modal').style.display = 'none';
            loadMedicalHistory(); // refresh to show 'View My Rating'
        } else {
            const data = await res.json();
            alert(data.detail || "Error submitting rating.");
        }
    } catch (e) {
        alert("Serverside error.");
    } finally {
        document.getElementById('rate-submit-btn').disabled = false;
        document.getElementById('rate-submit-btn').innerText = "Submit Rating";
    }
}

async function viewMyRating(booking_id, hospital_name) {
    document.getElementById('rm-title').innerText = `Your Rating for ${hospital_name}`;
    const c = document.getElementById('rm-content');
    c.innerHTML = "<em>Loading your rating...</em>";
    document.getElementById('reviews-modal').style.display = 'flex';

    try {
        const res = await fetch(`/api/patient/my-review/${booking_id}`);
        if (res.ok) {
            const data = await res.json();
            const r = data.review;
            c.innerHTML = `
                <div style="padding:1rem; background: rgba(0, 119, 182, 0.05); border-radius: 8px;">
                    <div style="font-size:1.2rem; font-weight:bold; color:var(--color-patient); margin-bottom:1rem; text-align:center;">
                        Overall Rating: ${r.overall_rating.toFixed(1)} ★
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:1rem; font-size:0.9rem; margin-bottom:1rem; justify-content:center;">
                        <span style="background:#fff; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc;">Doctor's Care: ${r.doctor_care}</span>
                        <span style="background:#fff; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc;">Hygiene: ${r.hygiene}</span>
                        <span style="background:#fff; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc;">Staff Behavior: ${r.staff_behavior}</span>
                        <span style="background:#fff; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc;">Facilities: ${r.facilities}</span>
                        <span style="background:#fff; padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc;">Speed: ${r.speed_of_service}</span>
                    </div>
                    <p style="font-size:0.95rem; line-height:1.5;">"${r.written_review || "No written feedback provided."}"</p>
                </div>
            `;
        } else {
            c.innerHTML = "<p style='color:red;'>Could not fetch your rating.</p>";
        }
    } catch (e) {
        c.innerHTML = "<p style='color:red;'>Error connecting to server.</p>";
    }
}

// Initialize Star Ratings
document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('patientSession');
    if (saved) {
        currentUser = JSON.parse(saved);
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('dash-name').innerText = currentUser.name;
        switchTab('search');
    }
    document.querySelectorAll('.star-rating').forEach(group => {
        const stars = group.querySelectorAll('.star');
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                const val = parseInt(e.target.getAttribute('data-val'));
                group.setAttribute('data-value', val);
                stars.forEach(s => {
                    const sVal = parseInt(s.getAttribute('data-val'));
                    if (sVal <= val) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
            });
        });
    });
});
