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

@router.get("/users")
def get_all_users():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        users = {"hospitals": [], "patients": [], "drivers": []}
        try:
            cur.execute("SELECT hospital_id as id, name, support_email as email, is_banned FROM hospitals")
            users['hospitals'] = cur.fetchall()
        except: pass
        try:
            cur.execute("SELECT patient_id as id, full_name as name, email, is_banned FROM patients")
            users['patients'] = cur.fetchall()
        except: pass
        try:
            cur.execute("SELECT driver_id as id, full_name as name, email, is_banned FROM drivers")
            users['drivers'] = cur.fetchall()
        except: pass
        conn.close()
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/{user_type}/{u_id}/ban")
def ban_user(user_type: str, u_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        table = None
        id_field = None
        if user_type == "hospital":
            table = "hospitals"
            id_field = "hospital_id"
        elif user_type == "patient":
            table = "patients"
            id_field = "patient_id"
        elif user_type == "driver":
            table = "drivers"
            id_field = "driver_id"
        else:
            raise Exception("Invalid user type")
            
        cur.execute(f"SELECT * FROM {table} WHERE {id_field}=%s", (u_id,))
        user = cur.fetchone()
        
        cur.execute(f"UPDATE {table} SET is_banned=TRUE WHERE {id_field}=%s", (u_id,))
        conn.commit()
        conn.close()
        
        if user:
            name = user.get('name', user.get('full_name', 'User'))
            email = user.get('support_email', user.get('email'))
            if email:
                try:
                    from utils import send_banned_email
                except ImportError:
                    from backend.utils import send_banned_email
                send_banned_email(email, name, user_type.capitalize())
        
        return {"message": f"{user_type.capitalize()} banned securely."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/queries")
def get_queries():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM support_queries ORDER BY created_at DESC")
        queries = cur.fetchall()
        for q in queries:
            if q.get('created_at'): q['created_at'] = str(q['created_at'])
        conn.close()
        return {"queries": queries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/{user_type}/{u_id}/spoof")
def spoof_user(user_type: str, u_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user = None
        if user_type == "hospital":
            cur.execute("SELECT hospital_id, name, contact_number, support_email as email FROM hospitals WHERE hospital_id=%s", (u_id,))
            user = cur.fetchone()
        elif user_type == "patient":
            cur.execute("SELECT patient_id, full_name, full_name as name, email, contact_number FROM patients WHERE patient_id=%s", (u_id,))
            user = cur.fetchone()
        elif user_type == "driver":
            cur.execute("SELECT driver_id, full_name, full_name as name, email, contact_number FROM drivers WHERE driver_id=%s", (u_id,))
            user = cur.fetchone()
        conn.close()
        return {"user": user}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QueryReplyRequest(BaseModel):
    reply_text: str

@router.post("/queries/{q_id}/reply")
def reply_query(q_id: int, req: QueryReplyRequest):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM support_queries WHERE id=%s", (q_id,))
        q = cur.fetchone()
        
        cur.execute("UPDATE support_queries SET status='Solved', reply_text=%s WHERE id=%s", (req.reply_text, q_id))
        conn.commit()
        conn.close()
        
        if q:
            try:
                from utils import send_query_reply_email
            except:
                from backend.utils import send_query_reply_email
            send_query_reply_email(q['email'], q['name'], q['query_text'], req.reply_text)
            
        return {"message": "Reply sent successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
