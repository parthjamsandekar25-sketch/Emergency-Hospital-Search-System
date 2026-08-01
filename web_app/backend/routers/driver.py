from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection
import mysql.connector
import bcrypt

router = APIRouter()

class DriverLoginRequest(BaseModel):
    userid: str
    password: str

class DriverRegisterRequest(BaseModel):
    name: str
    email: str
    contact: str
    vehicle_type: str
    vehicle_number: str
    userid: str
    pwd: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

temp_driver_regs = {}
active_dispatches = {}

@router.get("/dispatch/{driver_id}")
def get_driver_dispatch(driver_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT request_id, status FROM hospital_driver_requests WHERE driver_id=%s AND status LIKE 'DISP|%' ORDER BY request_id DESC LIMIT 1", (driver_id,))
        row = cur.fetchone()
        conn.close()
        
        if row:
            parts = row['status'].split('|')
            return {"dispatch": {
                "request_id": row['request_id'],
                "patient_name": parts[1] if len(parts) > 1 else "Unknown",
                "hospital_name": parts[2] if len(parts) > 2 else "Unknown",
                "contact_number": parts[3] if len(parts) > 3 else "N/A",
                "patient_lat": float(parts[4]) if len(parts) > 4 and parts[4] != 'None' else None,
                "patient_lon": float(parts[5]) if len(parts) > 5 and parts[5] != 'None' else None
            }}
    except Exception as e:
        pass
    return {"dispatch": None}

@router.post("/dispatch/{driver_id}/complete")
def complete_dispatch(driver_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM hospital_driver_requests WHERE driver_id=%s AND status LIKE 'DISP|%'", (driver_id,))
        cur.execute("UPDATE drivers SET status='Available' WHERE driver_id=%s", (driver_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        pass
    
    return {"message": "Dispatch completed and status reset"}

class LocationUpdateRequest(BaseModel):
    driver_id: int
    latitude: float
    longitude: float

class StatusUpdateRequest(BaseModel):
    driver_id: int
    status: str

class RespondRequest(BaseModel):
    request_id: int
    status: str
    driver_id: int
    hospital_id: int
    req_type: str

@router.get("/status")
def driver_status():
    return {"status": "Driver router is working"}

@router.post("/login")
def login(req: DriverLoginRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM drivers WHERE userid=%s", (req.userid,))
        driver = cur.fetchone()
        
        has_access = False
        if driver:
            db_pwd = driver['password'].encode('utf-8')
            req_pwd = req.password.encode('utf-8')
            # Check if stored is bcrypt hash
            if db_pwd.startswith(b'$2b$'):
                has_access = bcrypt.checkpw(req_pwd, db_pwd)
            else:
                has_access = (driver['password'] == req.password)
                
        if has_access:
            driver['name'] = driver['full_name']
            if driver['affiliated_hospital_id']:
                cur.execute("SELECT name FROM hospitals WHERE hospital_id=%s", (driver['affiliated_hospital_id'],))
                h = cur.fetchone()
                driver['hospital_name'] = h['name'] if h else None
            else:
                driver['hospital_name'] = None
        conn.close()
        
        if driver:
            return {"driver": driver, "message": "Login successful"}
        else:
            raise HTTPException(status_code=401, detail="Invalid User ID or Password.")
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=str(err))

@router.post("/init-register")
def init_register(req: DriverRegisterRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            from utils import is_userid_unique
        except ImportError:
            from backend.utils import is_userid_unique
            
        if not is_userid_unique(cur, req.userid):
            conn.close()
            raise HTTPException(status_code=400, detail="User ID is already taken by another account.")
            
        # Removed vehicle number constraint check since we no longer trace vehicles
            
        cur.execute("SELECT driver_id FROM drivers WHERE email=%s", (req.email,))
        if cur.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Email already registered.")
        conn.close()
        
        try:
            from utils import generate_otp, send_registration_otp_email
        except ImportError:
            from backend.utils import generate_otp, send_registration_otp_email
            
        otp = generate_otp(6)
        temp_driver_regs[req.email] = {"req": req, "otp": otp}
        
        send_registration_otp_email(req.email, req.name, otp)
        
        return {"message": "OTP sent"}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-register")
def verify_register(req: VerifyOTPRequest):
    if req.email not in temp_driver_regs:
        raise HTTPException(status_code=400, detail="No pending registration found for this email.")
        
    data = temp_driver_regs[req.email]
    if data["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    r = data["req"]
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = """INSERT INTO drivers 
                   (full_name, contact_number, email, vehicle_type, vehicle_number, license_number, userid, password, status) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Offline')"""
        hashed = bcrypt.hashpw(r.pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(query, (r.name, r.contact, r.email, r.vehicle_type, r.vehicle_number, "-", r.userid, hashed))
        conn.commit()
        conn.close()
        del temp_driver_regs[req.email]
        return {"message": "Registered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-status")
def update_status(req: StatusUpdateRequest):
    try:
        status_cap = req.status.capitalize()
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE drivers SET status=%s WHERE driver_id=%s", (status_cap, req.driver_id))
        conn.commit()
        conn.close()
        return {"message": "Status updated"}
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=str(err))

@router.post("/update-location")
def update_location(req: LocationUpdateRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE drivers SET latitude=%s, longitude=%s WHERE driver_id=%s", (req.latitude, req.longitude, req.driver_id))
        conn.commit()
        conn.close()
        return {"message": "Location updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/requests/{driver_id}")
def get_requests(driver_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        query = """SELECT r.request_id, r.status, r.hospital_id, h.name as hospital_name
                   FROM hospital_driver_requests r
                   JOIN hospitals h ON r.hospital_id = h.hospital_id
                   WHERE r.driver_id = %s AND r.status='pending'"""
        cur.execute(query, (driver_id,))
        records = cur.fetchall()
        conn.close()
        # Add req_type affiliation for context
        for r in records: r['req_type'] = 'Affiliation'
        return {"requests": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/respond")
def respond_request(req: RespondRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("UPDATE hospital_driver_requests SET status=%s WHERE request_id=%s", (req.status, req.request_id))
        
        hosp_name = None
        if req.status == 'accepted':
            cur.execute("UPDATE drivers SET affiliated_hospital_id=%s WHERE driver_id=%s", (req.hospital_id, req.driver_id))
            cur.execute("SELECT name FROM hospitals WHERE hospital_id=%s", (req.hospital_id,))
            h = cur.fetchone()
            if h: hosp_name = h['name']
        conn.commit()
        conn.close()
        return {"message": "Success", "hospital_name": hosp_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/profile/{driver_id}")
def delete_profile(driver_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM drivers WHERE driver_id=%s", (driver_id,))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        try:
            cur.execute("DELETE FROM hospital_driver_requests WHERE driver_id=%s", (driver_id,))
            cur.execute("DELETE FROM drivers WHERE driver_id=%s", (driver_id,))
            conn.commit()
        except:
            pass
        finally:
            conn.close()
        return {"message": "Attempted to delete"}
