import os

js_template = """
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
        const res = await fetch('/api/{ROLE}/forgot-password', {
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
        const res = await fetch('/api/{ROLE}/reset-password', {
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
"""

for role in ["patient", "driver", "admin"]:
    script = js_template.replace("{ROLE}", role)
    file_path = f"c:/Users/prafull jamsandekar/PycharmProjects/HospitalProject/web_app/frontend/{role}.js"
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(script)
