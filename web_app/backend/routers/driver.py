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
    name: str # will map to full_name
    contact: str
    vehicle_type: str
    vehicle_number: str
    userid: str
    pwd: str

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

@router.post("/register")
def register(req: DriverRegisterRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT driver_id FROM drivers WHERE userid=%s OR vehicle_number=%s", (req.userid, req.vehicle_number))
        if cur.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="User ID or Vehicle Number already registered.")
        
        query = """INSERT INTO drivers 
                   (full_name, contact_number, vehicle_type, vehicle_number, license_number, userid, password, status) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, 'Offline')"""
        
        hashed = bcrypt.hashpw(req.pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(query, (req.name, req.contact, req.vehicle_type, req.vehicle_number, req.vehicle_number, req.userid, hashed))
        conn.commit()
        conn.close()
        return {"message": "Registration successful"}
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=str(err))

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
