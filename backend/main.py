from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import patient, driver, admin

app = FastAPI(title="Hospital Management API")

# Update CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the Vite React url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patient.router, prefix="/api/patient", tags=["Patient"])
app.include_router(driver.router, prefix="/api/driver", tags=["Driver"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

# Mount static folder
app.mount("/static", StaticFiles(directory="../frontend"), name="static")

@app.get("/")
def root():
    return FileResponse("../frontend/index.html")
