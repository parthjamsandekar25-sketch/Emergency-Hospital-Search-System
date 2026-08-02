import smtplib
from email.mime.text import MIMEText
import numpy as np
import threading
import time
import random
import urllib.request
import json
import secrets

SENDER_EMAIL = "9c.parthjamsandekar@gmail.com"
SENDER_PASSWORD = "rdca iddq kgao kell"

def send_otp_email(to_email, patient_name, hospital_name, otp):
    subject = f"Discharge & Feedback OTP - {hospital_name}"
    body = f"Hello {patient_name},\n\nYou have been discharged from {hospital_name}.\n\nYour 4-digit OTP to rate your treatment stay is: {otp}\n\nPlease open the Hospital SOS Portal, click 'Rate Treatment (OTP)', and enter your email along with this OTP.\n\nThank you!"

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email failed to send: {e}")
        return False

def send_account_approved_email(to_email, hospital_name, base_url="http://localhost:8000"):
    subject = "Account Verified - Hospital Portal"
    body = (
        f"Hello {hospital_name},\n\n"
        f"Your registration request has been verified and approved.\n"
        f"You can now log in using the UserID and Password created by you during the registration process.\n\n"
        f"Regards,\nSystem Administrator"
    )
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
    except Exception:
        pass

def send_magic_link_email(to_email, hospital_name, token, base_url="http://localhost:8000"):
    subject = "Verify Your Hospital Registration Request"
    yes_link = f"{base_url}/api/admin/verify-magic-link?token={token}&decision=yes"
    no_link = f"{base_url}/api/admin/verify-magic-link?token={token}&decision=no"
    
    body = (
        f"<html><body>"
        f"<p>Hello {hospital_name},</p>"
        f"<p>We received a registration request for your hospital on the Hospital Portal.<br>"
        f"Did you request this?</p>"
        f"<a href='{yes_link}' style='display:inline-block; padding:10px 20px; background-color:#10b981; color:white; text-decoration:none; border-radius:5px; margin-right:10px; font-weight:bold;'>YES, it\\'s us</a>"
        f"<a href='{no_link}' style='display:inline-block; padding:10px 20px; background-color:#ef4444; color:white; text-decoration:none; border-radius:5px; font-weight:bold;'>NO, it\\'s not us</a>"
        f"<p>Regards,<br>System Administrator</p>"
        f"</body></html>"
    )

    msg = MIMEText(body, 'html')
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        import traceback
        raise Exception(f"Failed to send email: {str(e)} | Trace: {traceback.format_exc()}")

def send_registration_otp_email(to_email, patient_name, otp):
    subject = "Your Registration OTP - Hospital Patient Portal"
    body = (
        f"Hello {patient_name},\n\n"
        f"Thank you for registering on the Hospital Patient Portal.\n\n"
        f"Your 6-digit OTP for email verification is: {otp}\n\n"
        f"This OTP is valid for 10 minutes. Please do not share it with anyone.\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"Regards,\nHospital Patient Portal"
    )

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = SENDER_EMAIL
    msg['To'] = to_email

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        import traceback
        raise Exception(f"Failed to send email: {str(e)} | Trace: {traceback.format_exc()}")

def calculate_distances(lat1, lon1, lat2_array, lon2_array):
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2_array, lon2_array])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    c = 2 * np.arcsin(np.sqrt(a))
    return 6371 * c

_current_lat = 19.0649
_current_lon = 72.9150
_running = False

def _location_simulation_loop():
    global _current_lat, _current_lon
    try:
        with urllib.request.urlopen("http://ip-api.com/json/", timeout=5) as url:
            data = json.loads(url.read().decode())
        if data.get("status") == "success":
            _current_lat = float(data["lat"])
            _current_lon = float(data["lon"])
    except Exception as e:
        print("Location fetch failed, using fallback:", e)
        
    while _running:
        _current_lat += random.uniform(-0.00005, 0.00005)
        _current_lon += random.uniform(-0.00005, 0.00005)
        time.sleep(1)

def start_location_simulation():
    global _running
    if not _running:
        _running = True
        threading.Thread(target=_location_simulation_loop, daemon=True).start()

def get_live_location():
    return _current_lat, _current_lon

def generate_otp(length=6):
    return ''.join(secrets.choice('0123456789') for _ in range(length))

def is_userid_unique(cur, userid):
    cur.execute("SELECT patient_id FROM patients WHERE userid=%s", (userid,))
    if cur.fetchone(): return False
    cur.execute("SELECT driver_id FROM drivers WHERE userid=%s", (userid,))
    if cur.fetchone(): return False
    cur.execute("SELECT hospital_id FROM hospitals WHERE username=%s", (userid,))
    if cur.fetchone(): return False
    return True
