from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import get_db_connection

router = APIRouter()

@router.post("/webhook")
async def handle_form_submit(request: Request):
    try:
        data = await request.json()
    except:
        return {"status": "error", "message": "No JSON payload provided"}

    try:
        import json
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO webhook_logs (payload) VALUES (%s)", (json.dumps(data),))
        conn.commit()
        conn.close()
    except Exception as e:
        pass

    responder_email = data.get("responder_email", "").strip().lower()
    booking_id = data.get("booking_id")
    hospital_id = data.get("hospital_id")
    doctor_care = int(data.get("doctor_care", 0))
    hygiene = int(data.get("hygiene", 0))
    staff_behavior = int(data.get("staff_behavior", 0))
    facilities = int(data.get("facilities", 0))
    speed = int(data.get("speed_of_service", 0))
    review_text = data.get("written_review", "")

    if not responder_email:
        return {"status": "error", "message": "Responder email not captured"}
    if not booking_id:
        return {"status": "error", "message": "No booking ID provided"}

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        cur.execute("SELECT patient_email FROM bookings WHERE booking_id = %s", (booking_id,))
        b_record = cur.fetchone()
        
        if not b_record:
            conn.close()
            return {"status": "error", "message": "Booking ID not found"}
            
        registered_email = (b_record.get('patient_email') or "").strip().lower()
        if registered_email and responder_email != registered_email:
            conn.close()
            return {"status": "error", "message": "Security mismatch"}

        overall = sum([doctor_care, hygiene, staff_behavior, facilities, speed]) / 5.0
        
        cur.execute(
            """INSERT INTO reviews 
            (hospital_id, booking_id, doctor_care, hygiene, staff_behavior, facilities, speed_of_service, overall_rating, written_review, date_submitted) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURDATE())""",
            (hospital_id, booking_id, doctor_care, hygiene, staff_behavior, facilities, speed, overall, review_text)
        )
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
