from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection
import mysql.connector
import datetime
import random
import bcrypt

def send_otp(email, name, otp):
    try:
        try:
            from utils import send_registration_otp_email
        except ImportError:
            from backend.utils import send_registration_otp_email
        success = send_registration_otp_email(email, name, otp)
        if not success:
            raise Exception("send_registration_otp_email returned False")
    except Exception as e:
        raise Exception(f"SMTP FAILED: {str(e)}")

router = APIRouter()

class PatientLoginRequest(BaseModel):
    userid: str
    password: str

class PatientRegisterRequest(BaseModel):
    name: str # maps to full_name
    dob: str
    gender: str
    blood: str
    contact: str
    email: str
    address: str
    allergies: str
    userid: str
    pwd: str

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

class SearchRequest(BaseModel):
    treatment: str
    sort_by: str
    lat: Optional[float] = None
    lon: Optional[float] = None

class BookBedRequest(BaseModel):
    email: str
    name: str
    hospital_id: int
    treatment_id: int

class FamilyAddRequest(BaseModel):
    patient_id: int
    name: str # maps to full_name
    relation: str
    dob: str

class AccountUpdateRequest(BaseModel):
    patient_id: int
    cur_pwd: str
    new_uid: Optional[str] = None
    new_pwd: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    allergies: Optional[str] = None

temp_regs = {}

@router.post("/login")
def login(req: PatientLoginRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM patients WHERE userid=%s", (req.userid,))
        user = cur.fetchone()
        conn.close()
        
        has_access = False
        if user:
            db_pwd = user['password'].encode('utf-8')
            req_pwd = req.password.encode('utf-8')
            if db_pwd.startswith(b'$2b$'):
                has_access = bcrypt.checkpw(req_pwd, db_pwd)
            else:
                has_access = (user['password'] == req.password)
                
        if has_access:
            user['name'] = user['full_name']
            return {"user": user, "message": "Login successful"}
        else:
            raise HTTPException(status_code=401, detail="Invalid User ID or Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register")
def register(req: PatientRegisterRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check global uniqueness of User ID
        try:
            from utils import is_userid_unique
        except ImportError:
            from backend.utils import is_userid_unique
            
        if not is_userid_unique(cur, req.userid):
            conn.close()
            raise HTTPException(status_code=400, detail="User ID is already taken by another account.")
            
        cur.execute("SELECT patient_id FROM patients WHERE email=%s", (req.email,))
        if cur.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Email already exists.")
        conn.close()
        
        otp = str(random.randint(100000, 999999))
        temp_regs[req.email] = {"data": req.dict(), "otp": otp}
        
        try:
            send_otp(req.email, req.name, otp)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"SMTP FAILED: {str(e)}")
            
        return {"message": "OTP sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-otp")
def verify_otp(req: OTPVerifyRequest):
    if req.email not in temp_regs or temp_regs[req.email]["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    d = temp_regs[req.email]["data"]
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        query = """INSERT INTO patients 
                   (full_name, dob, gender, blood_group, contact_number, email, address, known_allergies, userid, password) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
        hashed = bcrypt.hashpw(d['pwd'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cur.execute(query, (d['name'], d['dob'], d['gender'], d['blood'], d['contact'], d['email'], d['address'], d['allergies'], d['userid'], hashed))
        conn.commit()
        conn.close()
        del temp_regs[req.email]
        return {"message": "Registration complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/emergency-search")
def emergency_search(req: SearchRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Use provided geolocation if allowed by browser, else fallback
        patient_lat = req.lat if req.lat is not None else 19.0760
        patient_lon = req.lon if req.lon is not None else 72.8777
        
        # Fixed ratings -> reviews and rating -> overall_rating
        query = """SELECT h.hospital_id, h.name, h.address_label, h.contact_number, h.latitude, h.longitude,
                   t.treatment_id, t.cost, t.available_beds,
                   IFNULL((SELECT AVG(overall_rating) FROM reviews WHERE hospital_id=h.hospital_id), 0) as avg_rating
                   FROM hospitals h
                   JOIN treatments t ON h.hospital_id = t.hospital_id
                   WHERE t.treatment_name = %s AND t.available_beds > 0"""
        cur.execute(query, (req.treatment,))
        results = cur.fetchall()
        conn.close()
        
        final_results = []
        for r in results:
            dist = abs(float(r['latitude']) - patient_lat) * 111.0 + abs(float(r['longitude']) - patient_lon) * 111.0
            r['distance_km'] = dist
            final_results.append(r)
            
        if "Nearest" in req.sort_by:
            final_results.sort(key=lambda x: x['distance_km'])
        elif "Cost" in req.sort_by:
            final_results.sort(key=lambda x: x['cost'])
        elif "Rating" in req.sort_by:
            final_results.sort(key=lambda x: x['avg_rating'], reverse=True)
            
        return {"results": final_results[:10]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reviews/{hospital_id}")
def get_hospital_reviews(hospital_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        query = """SELECT r.overall_rating, r.written_review, r.date_submitted,
                   (r.doctor_care + r.hygiene + r.staff_behavior + r.facilities + r.speed_of_service) / 5 as avg_cat
                   FROM reviews r
                   WHERE r.hospital_id = %s AND r.written_review IS NOT NULL AND r.written_review != ''
                   ORDER BY r.date_submitted DESC LIMIT 10"""
        cur.execute(query, (hospital_id,))
        reviews = cur.fetchall()
        conn.close()
        return {"reviews": reviews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/book-bed")
def book_bed(req: BookBedRequest):
    try:
        import datetime
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        now = datetime.datetime.now()
        clean_name = "".join([c for c in req.name if c.isalpha()]).lower()
        booking_id = f"{clean_name}{now.strftime('%y%m%d%H%M%S')}"

        query_b = "INSERT INTO bookings (booking_id, patient_email, patient_name, hospital_id, treatment_id, status) VALUES (%s, %s, %s, %s, %s, %s)"
        cur.execute(query_b, (booking_id, req.email, req.name, req.hospital_id, req.treatment_id, "Admitted"))
        
        query_u = "UPDATE treatments SET available_beds = available_beds - 1 WHERE treatment_id = %s"
        cur.execute(query_u, (req.treatment_id,))
        
        # Find available driver
        cur.execute("SELECT driver_id, full_name as name, contact_number, vehicle_type, vehicle_number FROM drivers WHERE affiliated_hospital_id=%s AND status='Available' LIMIT 1", (req.hospital_id,))
        driver = cur.fetchone()
        
        if driver:
            cur.execute("UPDATE drivers SET status='Busy' WHERE driver_id=%s", (driver['driver_id'],))
        
        conn.commit()
        conn.close()
        
        msg = f"EMERGENCY: Patient {req.name} successfully booked a bed."
        wa_link = f"https://wa.me/919999999999?text={msg.replace(' ', '%20')}"
        return {"message": "Booked", "wa_link": wa_link, "driver": driver}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{email}")
def get_history(email: str):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        query = """SELECT b.booking_id, b.status, h.name as hospital_name, t.treatment_name 
                   FROM bookings b
                   JOIN hospitals h ON b.hospital_id = h.hospital_id
                   LEFT JOIN treatments t ON b.treatment_id = t.treatment_id
                   WHERE b.patient_email = %s ORDER BY b.booking_id DESC"""
        cur.execute(query, (email,))
        records = cur.fetchall()
        conn.close()
        return {"bookings": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/family/{patient_id}")
def get_family(patient_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT member_id, patient_id, full_name, relation, dob FROM family_members WHERE patient_id=%s", (patient_id,))
        records = cur.fetchall()
        if records:
            for r in records:
                if isinstance(r['dob'], datetime.date):
                    r['dob'] = r['dob'].isoformat()
                r['member_name'] = r['full_name']
        conn.close()
        return {"family": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/family")
def add_family(req: FamilyAddRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO family_members (patient_id, full_name, relation, dob) VALUES (%s, %s, %s, %s)", 
                    (req.patient_id, req.name, req.relation, req.dob))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/family/{member_id}")
def delete_family(member_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM family_members WHERE member_id=%s", (member_id,))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-account")
def update_account(req: AccountUpdateRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM patients WHERE patient_id=%s AND password=%s", (req.patient_id, req.cur_pwd))
        user = cur.fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=400, detail="Incorrect current password")
            
        uid = req.new_uid if req.new_uid else user['userid']
        pwd = req.new_pwd if req.new_pwd else user['password']
        
        if req.new_uid and req.new_uid != user['userid']:
            try:
                from utils import is_userid_unique
            except ImportError:
                from backend.utils import is_userid_unique
            if not is_userid_unique(cur, req.new_uid):
                conn.close()
                raise HTTPException(status_code=400, detail="User ID is already taken by another account")
                
        if req.new_pwd:
            pwd = bcrypt.hashpw(req.new_pwd.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
        if req.contact:
            cur.execute("UPDATE patients SET contact_number=%s WHERE patient_id=%s", (req.contact, req.patient_id))
        if req.address:
            cur.execute("UPDATE patients SET address=%s WHERE patient_id=%s", (req.address, req.patient_id))
        if req.allergies:
            cur.execute("UPDATE patients SET known_allergies=%s WHERE patient_id=%s", (req.allergies, req.patient_id))
            
        cur.execute("UPDATE patients SET userid=%s, password=%s WHERE patient_id=%s", (uid, pwd, req.patient_id))
        conn.commit()
        
        cur.execute("SELECT * FROM patients WHERE patient_id=%s", (req.patient_id,))
        user = cur.fetchone()
        user['name'] = user['full_name']
        conn.close()
        return {"message": "Success", "user": user}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/profile/{patient_id}")
def delete_profile(patient_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM patients WHERE patient_id=%s", (patient_id,))
        conn.commit()
        conn.close()
        return {"message": "Success"}
    except Exception as e:
        try:
            cur.execute("DELETE FROM family_members WHERE patient_id=%s", (patient_id,))
            cur.execute("DELETE FROM patients WHERE patient_id=%s", (patient_id,))
            conn.commit()
        except:
            pass
        finally:
            conn.close()
        return {"message": "Attempted to delete"}
