from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection
import mysql.connector
import bcrypt

router = APIRouter()

class AdminLoginRequest(BaseModel):
    userid: str
    password: str

class AdminRegisterRequest(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    contact: str
    userid: str
    pwd: str

class OfflineAdmitRequest(BaseModel):
    hospital_id: int
    email: str
    treatment_id: int

class DischargeRequest(BaseModel):
    booking_id: int
    treatment_id: int

class InviteDriverRequest(BaseModel):
    hospital_id: int
    driver_userid: str

class TreatmentRequest(BaseModel):
    hospital_id: int
    treatment_name: str
    cost: int
    available_beds: int

class TreatmentUpdateRequest(BaseModel):
    cost: int
    available_beds: int

class ProfileUpdateRequest(BaseModel):
    hospital_id: int
    address_label: str
    contact_number: str
    latitude: float
    longitude: float

@router.get("/status")
def admin_status():
    return {"status": "Admin router is working"}

@router.post("/login")
def login(req: AdminLoginRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # Use username for hospitals table instead of userid
        cur.execute("SELECT * FROM hospitals WHERE username=%s", (req.userid,))
        admin = cur.fetchone()
        conn.close()
        
        has_access = False
        if admin:
            db_pwd = admin['password'].encode('utf-8')
            req_pwd = req.password.encode('utf-8')
            if db_pwd.startswith(b'$2b$'):
                has_access = bcrypt.checkpw(req_pwd, db_pwd)
            else:
                has_access = (admin['password'] == req.password)
                
        if has_access:
            return {"admin": admin, "message": "Login successful"}
        else:
            raise HTTPException(status_code=401, detail="Invalid Username or Password.")
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=str(err))

@router.post("/register")
def register(req: AdminRegisterRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT hospital_id FROM hospitals WHERE username=%s", (req.userid,))
        if cur.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="User ID (Username) already exists.")
        
        query = "INSERT INTO hospitals (name, address_label, latitude, longitude, contact_number, username, password) VALUES (%s, %s, %s, %s, %s, %s, %s)"
        hashed = bcrypt.hashpw(req.pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(query, (req.name, req.address, req.latitude, req.longitude, req.contact, req.userid, hashed))
        conn.commit()
        conn.close()
        return {"message": "Registration successful"}
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=str(err))

@router.get("/patients/{hospital_id}")
def get_patients(hospital_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        query = """SELECT b.booking_id, b.patient_email, b.treatment_id, b.status 
                   FROM bookings b WHERE b.hospital_id=%s"""
        cur.execute(query, (hospital_id,))
        patients = cur.fetchall()
        conn.close()
        return {"patients": patients}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/offline-admit")
def offline_admit(req: OfflineAdmitRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "INSERT INTO bookings (patient_email, hospital_id, treatment_id, status) VALUES (%s, %s, %s, 'Admitted')"
        cur.execute(query, (req.email, req.hospital_id, req.treatment_id))
        
        upd = "UPDATE treatments SET available_beds = available_beds - 1 WHERE treatment_id = %s"
        cur.execute(upd, (req.treatment_id,))
        
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/discharge")
def discharge(req: DischargeRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE bookings SET status='Discharged' WHERE booking_id=%s", (req.booking_id,))
        cur.execute("UPDATE treatments SET available_beds = available_beds + 1 WHERE treatment_id=%s", (req.treatment_id,))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fleet/{hospital_id}")
def get_fleet(hospital_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT driver_id, full_name, vehicle_type, vehicle_number, status, contact_number FROM drivers WHERE affiliated_hospital_id=%s", (hospital_id,))
        drivers = cur.fetchall()
        for d in drivers:
            d['name'] = d['full_name']
        conn.close()
        return {"drivers": drivers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invite-driver")
def invite_driver(req: InviteDriverRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT driver_id FROM drivers WHERE userid=%s", (req.driver_userid,))
        driver = cur.fetchone()
        if not driver:
            conn.close()
            raise HTTPException(status_code=404, detail="Driver User ID not found")
            
        cur.execute("INSERT INTO hospital_driver_requests (hospital_id, driver_id, status) VALUES (%s, %s, 'pending')", 
                    (req.hospital_id, driver['driver_id']))
        conn.commit()
        conn.close()
        return {"message": "Invite Sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/treatments/{hospital_id}")
def get_treatments(hospital_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        query = "SELECT treatment_id, treatment_name, cost, available_beds FROM treatments WHERE hospital_id=%s"
        cur.execute(query, (hospital_id,))
        treatments = cur.fetchall()
        conn.close()
        return {"treatments": treatments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/treatments")
def add_treatment(req: TreatmentRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "INSERT INTO treatments (hospital_id, treatment_name, cost, available_beds) VALUES (%s, %s, %s, %s)"
        cur.execute(query, (req.hospital_id, req.treatment_name, req.cost, req.available_beds))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/treatments/{treatment_id}")
def update_treatment(treatment_id: int, req: TreatmentUpdateRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "UPDATE treatments SET cost=%s, available_beds=%s WHERE treatment_id=%s"
        cur.execute(query, (req.cost, req.available_beds, treatment_id))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/profile")
def update_profile(req: ProfileUpdateRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = "UPDATE hospitals SET address_label=%s, contact_number=%s, latitude=%s, longitude=%s WHERE hospital_id=%s"
        cur.execute(query, (req.address_label, req.contact_number, req.latitude, req.longitude, req.hospital_id))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/profile/{hospital_id}")
def delete_profile(hospital_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM hospitals WHERE hospital_id=%s", (hospital_id,))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        # Cascade deletes should handle related tables if they are defined, else it might throw an error.
        # Ensure that treatments, bookings, requests are deleted or handled by ON DELETE CASCADE.
        # For a thorough deletion:
        try:
            cur.execute("DELETE FROM treatments WHERE hospital_id=%s", (hospital_id,))
            cur.execute("DELETE FROM bookings WHERE hospital_id=%s", (hospital_id,))
            cur.execute("DELETE FROM hospital_driver_requests WHERE hospital_id=%s", (hospital_id,))
            cur.execute("DELETE FROM hospitals WHERE hospital_id=%s", (hospital_id,))
            conn.commit()
        except:
            pass
        finally:
            conn.close()
        return {"message": "Attempted to delete"}
