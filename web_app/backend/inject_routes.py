import os

base_routes = """

class ForgotPasswordRequest(BaseModel):
    userid: str = ""
    email: str = ""

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

temp_pwd_reset = {}

@router.post("/forgot-password")
def forgot_pwd(req: ForgotPasswordRequest):
    if not req.userid and not req.email:
        raise HTTPException(status_code=400, detail="Provide userid or email")
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        query_field = "{USERID_COL}"
        table = "{TABLE}"
        name_col = "{NAME_COL}"
        pwd_col = "{PWD_COL}"
        email_col = "{EMAIL_COL}"
        
        if req.userid:
            cur.execute(f"SELECT {name_col} as name, {email_col} as email FROM {table} WHERE {query_field}=%s", (req.userid,))
        else:
            cur.execute(f"SELECT {name_col} as name, {email_col} as email FROM {table} WHERE {email_col}=%s", (req.email,))
        user = cur.fetchone()
        conn.close()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        import random
        from utils import send_pwd_reset_otp_email
        otp_val = str(random.randint(100000, 999999))
        temp_pwd_reset[user['email']] = otp_val
        
        send_pwd_reset_otp_email(user['email'], user['name'], otp_val)
        
        e = user['email']
        masked = e[:2] + "***@" + e.split("@")[1] if "@" in e else e
        return {"status": "ok", "email": e, "email_masked": masked}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reset-password")
def reset_pwd(req: ResetPasswordRequest):
    if req.email not in temp_pwd_reset or temp_pwd_reset[req.email] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        import bcrypt
        hashed = bcrypt.hashpw(req.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        table = "{TABLE}"
        pwd_col = "{PWD_COL}"
        email_col = "{EMAIL_COL}"
        
        cur.execute(f"UPDATE {table} SET {pwd_col}=%s WHERE {email_col}=%s", (hashed, req.email))
        conn.commit()
        conn.close()
        del temp_pwd_reset[req.email]
        return {"message": "Password updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
"""

configs = {
    "patient": {
        "USERID_COL": "userid",
        "TABLE": "patients",
        "NAME_COL": "name",
        "PWD_COL": "pwd",
        "EMAIL_COL": "email"
    },
    "driver": {
        "USERID_COL": "userid",
        "TABLE": "drivers",
        "NAME_COL": "full_name",
        "PWD_COL": "pwd",
        "EMAIL_COL": "email"
    },
    "admin": {
        "USERID_COL": "username",
        "TABLE": "hospitals",
        "NAME_COL": "name",
        "PWD_COL": "password",
        "EMAIL_COL": "support_email"
    }
}

for prefix, config in configs.items():
    routes = base_routes \
        .replace("{USERID_COL}", config["USERID_COL"]) \
        .replace("{TABLE}", config["TABLE"]) \
        .replace("{NAME_COL}", config["NAME_COL"]) \
        .replace("{PWD_COL}", config["PWD_COL"]) \
        .replace("{EMAIL_COL}", config["EMAIL_COL"])
        
    file_path = f"c:/Users/prafull jamsandekar/PycharmProjects/HospitalProject/web_app/backend/routers/{prefix}.py"
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(routes)
