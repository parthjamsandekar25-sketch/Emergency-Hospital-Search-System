from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import get_db_connection
import bcrypt
import mysql.connector

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(req: LoginRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM superadmins WHERE email=%s", (req.email,))
        admin = cur.fetchone()
        conn.close()
        
        if admin:
            db_pwd = admin['password_hash'].encode('utf-8')
            req_pwd = req.password.encode('utf-8')
            if bcrypt.checkpw(req_pwd, db_pwd):
                return {"message": "Login successful", "admin": {"email": admin['email']}}
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/requests/hospitals")
def get_pending_hospitals():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name, address_label, support_email, contact_number, username, created_at FROM pending_hospitals")
        reqs = cur.fetchall()
        for r in reqs:
            if 'created_at' in r and r['created_at']:
                r['created_at'] = str(r['created_at'])
        conn.close()
        return {"requests": reqs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/hospitals/{id}/approve")
def approve_hospital(id: int, request: Request):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM pending_hospitals WHERE id=%s", (id,))
        hosp = cur.fetchone()
        if not hosp:
            conn.close()
            raise HTTPException(status_code=404, detail="Request not found")
            
        # Move to hospitals table
        query = "INSERT INTO hospitals (name, address_label, support_email, latitude, longitude, contact_number, username, password) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
        cur.execute(query, (hosp['name'], hosp['address_label'], hosp['support_email'], hosp['latitude'], hosp['longitude'], hosp['contact_number'], hosp['username'], hosp['password']))
        
        # Delete from pending
        cur.execute("DELETE FROM pending_hospitals WHERE id=%s", (id,))
        conn.commit()
        conn.close()
        
        # Send Email
        try:
            from utils import send_account_approved_email
        except ImportError:
            from backend.utils import send_account_approved_email
            
        base_url = str(request.base_url).rstrip('/')
        send_account_approved_email(hosp['support_email'], hosp['name'], base_url)
        
        return {"message": "Hospital approved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/hospitals/{id}/reject")
def reject_hospital(id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM pending_hospitals WHERE id=%s", (id,))
        conn.commit()
        conn.close()
        return {"message": "Hospital rejected securely"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/requests/updates")
def get_pending_updates():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # Join with hospitals to get the name
        query = """
        SELECT pu.*, h.name as hospital_name, h.address_label as old_address, h.contact_number as old_contact
        FROM pending_hospital_updates pu
        JOIN hospitals h ON pu.hospital_id = h.hospital_id
        """
        cur.execute(query)
        reqs = cur.fetchall()
        for r in reqs:
            if 'created_at' in r and r['created_at']:
                r['created_at'] = str(r['created_at'])
        conn.close()
        return {"requests": reqs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/requests/updates/{update_id}/approve")
def approve_update(update_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM pending_hospital_updates WHERE id=%s", (update_id,))
        upd = cur.fetchone()
        if not upd:
            conn.close()
            raise HTTPException(status_code=404, detail="Update request not found")
            
        cur.execute("UPDATE hospitals SET address_label=%s, contact_number=%s, latitude=%s, longitude=%s WHERE hospital_id=%s", 
                    (upd['address_label'], upd['contact_number'], upd['latitude'], upd['longitude'], upd['hospital_id']))
        cur.execute("DELETE FROM pending_hospital_updates WHERE id=%s", (update_id,))
        conn.commit()
        conn.close()
        return {"message": "Hospital update applied successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_analytics():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        stats = {}
        cur.execute("SELECT COUNT(*) FROM hospitals")
        stats['hospitals'] = cur.fetchone()[0]
        
        try: 
            cur.execute("SELECT COUNT(*) FROM drivers")
            stats['drivers'] = cur.fetchone()[0]
        except: pass
        
        try:
            cur.execute("SELECT COUNT(*) FROM patients")
            stats['patients'] = cur.fetchone()[0]
        except: pass
        
        try:
            cur.execute("SELECT COUNT(*) FROM bookings WHERE status='Admitted'")
            stats['active_emergencies'] = cur.fetchone()[0]
        except: pass
        
        conn.close()
        return {"analytics": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
