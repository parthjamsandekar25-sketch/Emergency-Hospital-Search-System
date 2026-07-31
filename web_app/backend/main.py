import os
import sys

# Ensure the backend directory is in the path for Vercel serverless imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

import database
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import admin, patient, driver, webhook

app = FastAPI(title="Hospital Management API")

# Update CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the Vite React url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(patient.router, prefix="/api/patient", tags=["Patient"])
app.include_router(driver.router, prefix="/api/driver", tags=["Driver"])
app.include_router(webhook.router, prefix="/api", tags=["Webhook"])

import os
# Mount static folder only if not on Vercel and frontend exists
if not os.environ.get("VERCEL"):
    frontend_path = "../frontend"
    if os.path.exists(frontend_path):
        app.mount("/static", StaticFiles(directory=frontend_path), name="static")

        @app.get("/")
        def root():
            return FileResponse(f"{frontend_path}/index.html")
