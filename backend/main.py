from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, time, timedelta
import uvicorn
from enum import Enum
import random
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text
import json
import hashlib
import asyncio

# Import your database components
# Ensure database.py is in the same directory as main.py
from database import SessionLocal, engine, Base, Dept, EmployeeDB, AttendanceDB, DesignationDB, WorkLocationDB, get_db

# If you uncomment the line below and run it, it will try to create tables
# based on your SQLAlchemy models. DO NOT RUN THIS ON YOUR EXISTING DATABASE
# if you want to preserve data, as it might drop and recreate tables or cause conflicts.
# Base.metadata.create_all(bind=engine)

app = FastAPI(title="Employee Analytics API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows all origins, adjust in production for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models (for API request/response validation) ---

class Gender(str, Enum):
    MALE = "Male"
    FEMALE = "Female"

class Department(BaseModel):
    dept_id: int
    dept_name: str

class Designation(BaseModel):
    designation_id: int
    designation_name: str
    dept_id: int

class Employee(BaseModel):
    # Frontend expects 'id' and 'name'
    id: int # Mapped to emp_id
    name: str # Mapped to full_name
    gender: Gender
    department: str # Mapped to dept_name
    designation: Optional[str] = None # Mapped to designation_name
    email: Optional[str] = None
    contactName: Optional[str] = None # Frontend uses camelCase
    hireDate: Optional[date] = None # Frontend uses camelCase
    dateOfBirth: Optional[date] = None # Frontend uses camelCase
    currentAddress: Optional[str] = None # Frontend uses camelCase
    distanceFromOffice: Optional[float] = None # Frontend uses camelCase
    totalExperience: Optional[float] = None # Frontend uses camelCase
    travelKm: Optional[float] = None # Frontend's mock data used this, map distanceFromOffice to it

    class Config:
        from_attributes = True
        json_encoders = {
            float: lambda v: v
        }


class AttendanceStatus(str, Enum):
    # IMPORTANT: These values must EXACTLY match the strings stored in your database's attendance_status column.
    # Based on your data generation script, these are: "OnTime", "Late", "Absent", "Half Day".
    # If "Present" is also a direct value in your DB, include it.
    ON_TIME = "OnTime"   # Corrected to match "OnTime" from DB (no space)
    LATE = "Late"
    ABSENT = "Absent"
    HALF_DAY = "Half Day"
    PRESENT = "Present" # Include if "Present" is a direct value in your DB

# Define a Pydantic model for individual attendance records as expected by frontend grid
class FrontendAttendanceRecord(BaseModel):
    id: int # This is emp_id, used as a unique key for the grid row for a given date
    employeeId: int # Frontend uses employeeId
    employeeName: str # Frontend uses employeeName
    department: str # Frontend uses department name
    gender: str # Frontend uses gender
    status: AttendanceStatus # Frontend expects string
    checkInTime: Optional[str] = None # Frontend expects checkInTime
    checkOutTime: Optional[str] = None # Frontend expects checkOutTime
    late_by: Optional[str] = None # Frontend expects late_by
    date: date # Frontend expects date

    class Config:
        from_attributes = True

# New Pydantic model for a single employee's attendance history record
class EmployeeAttendanceHistoryRecord(BaseModel):
    attendanceId: int # Assuming AttendanceDB has an ID
    date: date
    punchInTime: Optional[str] = None
    punchOutTime: Optional[str] = None
    status: str # e.g., "Present", "Absent", "Late", "Half Day"
    lateBy: Optional[str] = None # Duration of late
    duration: Optional[str] = None # Total work duration

    class Config:
        from_attributes = True

class AttendanceTrend(BaseModel):
    month: str
    presentPercent: float
    latePercent: float
    absentPercent: float # Frontend mock data has this

# Pydantic model for department statistics
class DepartmentStats(BaseModel):
    departmentName: str
    totalEmployees: int
    # Add other departmental stats here if your frontend expects them
    # For example:
    # avgPresentPercent: float = 0.0
    # lateTodayCount: int = 0

# --- Global Constants for Attendance Logic ---
# These are still relevant for calculating "late_by" if needed,
# but the primary status will come from the DB.
STANDARD_PUNCHIN = datetime.strptime("08:30:00", "%H:%M:%S").time()
GRACE_PERIOD = timedelta(minutes=15)
STANDARD_PUNCHIN_WITH_GRACE = (datetime.combine(date.min, STANDARD_PUNCHIN) + GRACE_PERIOD).time()
HALF_DAY_THRESHOLD = timedelta(hours=4, minutes=30)
HALF_DAY_THRESHOLD_SECONDS = HALF_DAY_THRESHOLD.total_seconds()

# In-memory cache for attendance data
ATTENDANCE_CACHE = {}
CACHE_TTL_SECONDS = 300 # Cache for 5 minutes

# --- API Endpoints ---

@app.get("/")
def read_root():
    """Root endpoint to confirm API is running."""
    return {"message": "Employee Analytics API is running and connected to PostgreSQL!"}

@app.get("/employees", response_model=List[Employee])
def get_employees(
    db: Session = Depends(get_db),
    gender: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    travel_distance_min: Optional[float] = Query(None, alias="travelDistanceMin"),
    travel_distance_max: Optional[float] = Query(None, alias="travelDistanceMax"),
    experience_min: Optional[float] = Query(None, alias="totalExperienceMin"),
    experience_max: Optional[float] = Query(None, alias="totalExperienceMax")
):
    """
    Fetches employees with filters.
    Frontend expects specific query param names and response structure.
    """
    query = db.query(
        EmployeeDB,
        Dept.dept_name,
        DesignationDB.designation_name
    ).outerjoin(Dept, EmployeeDB.dept_id == Dept.dept_id)\
     .outerjoin(DesignationDB, EmployeeDB.designation_id == DesignationDB.designation_id)

    if gender and gender.lower() != 'all':
        query = query.filter(func.lower(EmployeeDB.gender) == gender.lower())

    if department and department.lower() != 'all':
        try:
            dept_id = int(department)
            query = query.filter(EmployeeDB.dept_id == dept_id)
        except ValueError:
            query = query.filter(func.lower(Dept.dept_name).ilike(f"%{department.lower()}%"))

    if travel_distance_min is not None:
        query = query.filter(EmployeeDB.distance_from_office >= travel_distance_min)
    if travel_distance_max is not None:
        query = query.filter(EmployeeDB.distance_from_office <= travel_distance_max)
    if experience_min is not None:
        query = query.filter(EmployeeDB.total_exp >= experience_min)
    if experience_max is not None:
        query = query.filter(EmployeeDB.total_exp <= experience_max)

    employees_from_db = query.all()

    result_employees = []
    for emp_db, dept_name, designation_name in employees_from_db:
        result_employees.append(Employee(
            id=emp_db.emp_id,
            name=emp_db.full_name,
            gender=Gender(emp_db.gender),
            department=dept_name,
            designation=designation_name,
            email=emp_db.email,
            contactName=emp_db.contact_name,
            hireDate=emp_db.hire_date,
            dateOfBirth=emp_db.date_of_birth,
            currentAddress=emp_db.current_address,
            distanceFromOffice=emp_db.distance_from_office,
            totalExperience=emp_db.total_exp,
            travelKm=emp_db.distance_from_office
        ))
    return result_employees

@app.get("/departments", response_model=List[Department])
def get_departments(db: Session = Depends(get_db)):
    """Fetches all departments from the database."""
    try:
        departments = db.query(Dept).order_by(Dept.dept_name).all()
        return [Department(dept_id=d.dept_id, dept_name=d.dept_name) for d in departments]
    except Exception as e:
        print(f"Error fetching departments: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch departments: {e}")

@app.get("/attendance", response_model=dict)
async def fetch_attendance_data_optimized(
    db: Session = Depends(get_db),
    date_filter: str = Query(default=date.today().isoformat()),
    employee_name_filter: str = Query(default=""),
    department_filter: str = Query(default=""),
    gender_filter: str = Query(default=""),
    attendance_status_filter: str = Query(default=""),
    page: int = Query(default=1),
    records_per_page: int = Query(default=10)
):
    """
    Fetches paginated attendance data with various filters (date, employee name,
    department, gender, and attendance status) matching frontend expectations.
    """
    employee_name_filter = employee_name_filter.strip().lower()
    department_filter = department_filter.strip()
    gender_filter = gender_filter.strip().lower()
    attendance_status_filter = attendance_status_filter.strip().replace(' ', '_').lower()

    try:
        date_obj = datetime.strptime(date_filter, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. UseYYYY-MM-DD.")

    # --- Caching Logic ---
    cache_key_data = {
        'date': date_filter,
        'name': employee_name_filter,
        'department': department_filter,
        'gender': gender_filter,
        'status': attendance_status_filter,
        'page': page,
        'records_per_page': records_per_page
    }
    cache_key_string = json.dumps(cache_key_data, sort_keys=True)
    cache_key_hash = hashlib.sha256(cache_key_string.encode('utf-8')).hexdigest()

    cached_response = ATTENDANCE_CACHE.get(cache_key_hash)
    if cached_response and (datetime.now() - cached_response['timestamp']).total_seconds() < CACHE_TTL_SECONDS:
        print(f"Returning cached response for key: {cache_key_hash}")
        return cached_response['data']
    # --- End Caching Logic ---

    try:
        offset = (page - 1) * records_per_page

        # --- Base Employee Query (to get all employees matching filters) ---
        employee_base_query = db.query(
            EmployeeDB.emp_id,
            EmployeeDB.full_name,
            Dept.dept_name,
            EmployeeDB.gender
        ).outerjoin(Dept, EmployeeDB.dept_id == Dept.dept_id)

        if department_filter:
            try:
                dept_id = int(department_filter)
                employee_base_query = employee_base_query.filter(EmployeeDB.dept_id == dept_id)
            except ValueError:
                employee_base_query = employee_base_query.filter(func.lower(Dept.dept_name).ilike(f"%{department_filter.lower()}%"))

        if employee_name_filter:
            employee_base_query = employee_base_query.filter(func.lower(EmployeeDB.full_name).ilike(f"%{employee_name_filter}%"))

        if gender_filter:
            employee_base_query = employee_base_query.filter(func.lower(EmployeeDB.gender) == gender_filter)

        employee_filtered_results = employee_base_query.all()
        employee_ids_in_filter = [emp.emp_id for emp in employee_filtered_results]
        employee_data_map = {emp.emp_id: {'full_name': emp.full_name, 'dept_name': emp.dept_name, 'gender': emp.gender} for emp in employee_filtered_results}

        # Handle case where no employees match filters for the date
        if not employee_ids_in_filter:
            response_data = {
                "date": str(date_obj),
                "total_present": 0, "on_time_count": 0, "late_count": 0, "half_day_count": 0, "absent_count": 0,
                "on_time_employees": [], "late_employees": [], "half_day_employees": [], "absent_employees": [],
                "page": 1, "total_pages": 1,
                "message": "No employee data or attendance records available for these filters."
            }
            ATTENDANCE_CACHE[cache_key_hash] = {'data': response_data, 'timestamp': datetime.now()}
            print(f"Returning empty response (no matching employees) for key: {cache_key_hash}")
            return response_data


        # --- Fetching Attendance Records directly from DB, including status ---
        # Group by emp_id and attendance_status to ensure correct status is picked
        attendance_query = db.query(
            AttendanceDB.emp_id,
            AttendanceDB.attendance_status, # Fetch attendance status directly
            func.min(case((AttendanceDB.punch_type == 'punch_in', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_in_time_str'),
            func.max(case((AttendanceDB.punch_type == 'punch_out', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_out_time_str')
        ).filter(
            AttendanceDB.attendance_date == date_obj,
            AttendanceDB.emp_id.in_(employee_ids_in_filter)
        ).group_by(
            AttendanceDB.emp_id,
            AttendanceDB.attendance_status # Group by status as well
        )

        attendance_results = attendance_query.all()
        attendance_map = {}
        for rec in attendance_results:
            attendance_map[rec.emp_id] = {
                'status': rec.attendance_status,
                'punch_in_time_str': rec.punch_in_time_str,
                'punch_out_time_str': rec.punch_out_time_str
            }

        # --- Prepare FrontendAttendanceRecord list ---
        all_calculated_statuses_for_date: List[FrontendAttendanceRecord] = []
        
        for emp_id, emp_details in employee_data_map.items():
            attendance_data = attendance_map.get(emp_id)
            
            status = "Absent" # Default status if no attendance record is found for the date
            punch_in_time_str = None
            punch_out_time_str = None
            late_by_display = None

            if attendance_data:
                status = attendance_data['status']
                punch_in_time_str = attendance_data['punch_in_time_str']
                punch_out_time_str = attendance_data['punch_out_time_str']
                
                # Recalculate late_by if original status from DB is 'Late' or 'OnTime' (and punch_in is available)
                # This is specifically for the 'late_by' field, not overriding the DB status
                if (status.lower() == 'late' or status.lower() == 'ontime') and punch_in_time_str: # Use 'ontime' here
                    try:
                        punch_in_time_obj = datetime.strptime(punch_in_time_str, "%H:%M:%S").time()
                        punch_in_dt = datetime.combine(date_obj, punch_in_time_obj)
                        standard_punchin_dt = datetime.combine(date_obj, STANDARD_PUNCHIN_WITH_GRACE)
                        
                        late_by_interval = punch_in_dt - standard_punchin_dt
                        if late_by_interval.total_seconds() > 0: # Only show late_by if genuinely late
                            total_seconds = late_by_interval.total_seconds()
                            hours, remainder = divmod(total_seconds, 3600)
                            minutes, seconds = divmod(remainder, 60)
                            late_by_display = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"
                    except ValueError:
                        print(f"Warning: Could not parse punch_in_time_str '{punch_in_time_str}' for emp_id {emp_id} while calculating late_by.")


            all_calculated_statuses_for_date.append(FrontendAttendanceRecord(
                id=emp_id,
                employeeId=emp_id,
                employeeName=emp_details['full_name'],
                department=emp_details['dept_name'],
                gender=emp_details['gender'],
                status=AttendanceStatus(status), # Directly use the status string from DB
                checkInTime=punch_in_time_str,
                checkOutTime=punch_out_time_str,
                late_by=late_by_display,
                date=date_obj
            ))


        # --- Filtering and Counting Based on Fetched Statuses ---
        final_filtered_employees_for_display = []
        total_on_time = 0
        total_late = 0
        total_half_day = 0
        total_absent = 0

        for emp_rec in all_calculated_statuses_for_date: # Iterate over all calculated statuses
            current_status = emp_rec.status.value.lower() # Use value directly from Enum

            # Update counts regardless of the specific filter
            if current_status == "ontime": # Use 'ontime' here
                total_on_time += 1
            elif current_status == "late":
                total_late += 1
            elif current_status == "half day":
                total_half_day += 1
            elif current_status == "absent":
                total_absent += 1
            elif current_status == "present": # Handle general 'Present' if it exists in DB
                # If 'Present' is in DB, we need to decide if it's 'On Time' or 'Late' for counts
                # based on whether 'late_by' was calculated.
                if emp_rec.late_by:
                    total_late += 1
                else:
                    total_on_time += 1

            # Apply the attendance status filter for the 'final_filtered_employees_for_display' list
            # Normalize filter input and current status for comparison
            normalized_filter = attendance_status_filter.lower().replace('_', '') # Remove underscore for comparison
            normalized_current_status = emp_rec.status.value.lower().replace(' ', '') # Remove space for comparison

            if not normalized_filter or normalized_current_status == normalized_filter:
                final_filtered_employees_for_display.append(emp_rec)


        # Sort for consistent pagination (optional, but good practice)
        final_filtered_employees_for_display.sort(key=lambda x: x.employeeName)

        filtered_total_records = len(final_filtered_employees_for_display)
        total_pages = (filtered_total_records + records_per_page - 1) // records_per_page if filtered_total_records > 0 else 1

        paginated_employees_records = final_filtered_employees_for_display[offset : offset + records_per_page]

        # Dynamically populate the lists based on the attendance_status_filter
        # These lists will now contain only the paginated records filtered by specific status
        on_time_list = []
        late_list = []
        half_day_list = []
        absent_list = []

        # Populate lists based on the actual status of the paginated records
        for rec in paginated_employees_records:
            normalized_rec_status = rec.status.value.lower()
            if normalized_rec_status == "ontime": # Use 'ontime' here
                on_time_list.append(rec.model_dump())
            elif normalized_rec_status == "late":
                late_list.append(rec.model_dump())
            elif normalized_rec_status == "half day":
                half_day_list.append(rec.model_dump())
            elif normalized_rec_status == "absent":
                absent_list.append(rec.model_dump())
            elif normalized_rec_status == "present": # If 'Present' is in DB, categorize for lists
                if rec.late_by:
                    late_list.append(rec.model_dump())
                else:
                    on_time_list.append(rec.model_dump())


        response_data = {
            "date": str(date_obj),
            "total_present": total_on_time + total_late + total_half_day,
            "on_time_count": total_on_time,
            "late_count": total_late,
            "half_day_count": total_half_day,
            "absent_count": total_absent,
            "on_time_employees": on_time_list, # Use dynamically populated lists
            "late_employees": late_list,
            "half_day_employees": half_day_list,
            "absent_employees": absent_list,
            "page": page,
            "total_pages": total_pages,
            "message": ""
        }
        if not (total_on_time + total_late + total_half_day + total_absent) and not (employee_name_filter or department_filter or gender_filter):
            response_data["message"] = "No attendance data available for this date."


        ATTENDANCE_CACHE[cache_key_hash] = {
            'data': response_data,
            'timestamp': datetime.now()
        }
        print(f"Cached response for key: {cache_key_hash}")

        return response_data

    except Exception as e:
        print(f"Error in fetch_attendance_data_optimized: {e}")
        raise HTTPException(status_code=500, detail=f"Something went wrong while fetching attendance: {e}")

@app.get("/attendance/trends", response_model=List[AttendanceTrend])
def get_attendance_trends():
    """
    This endpoint now provides mock data matching the frontend's expected structure
    including 'absentPercent'. In a real implementation, this would come from the database.
    """
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return [
        AttendanceTrend(
            month=month,
            presentPercent=round(random.uniform(80, 90), 1),
            latePercent=round(random.uniform(5, 15), 1),
            absentPercent=round(random.uniform(0, 10), 1)
        ) for month in months
    ]

# # NEW ENDPOINT: Fetches all attendance records for the grid view for a given date
# @app.get("/attendance/records", response_model=List[FrontendAttendanceRecord])
# async def get_all_attendance_records_for_grid(
#     db: Session = Depends(get_db),
#     date_filter: Optional[str] = Query(None) # Changed default to None
# ):
#     """
#     Fetches all attendance records for a specific date, formatted for the frontend grid.
#     If no date_filter is provided, it defaults to the latest date with data in the DB.
#     """
#     date_obj = None
#     if date_filter:
#         try:
#             date_obj = datetime.strptime(date_filter, "%Y-%m-%d").date()
#         except ValueError:
#             raise HTTPException(status_code=400, detail="Invalid date format. UseYYYY-MM-DD.")

#     # If date_obj is still None (no filter provided or invalid format), find the latest date in DB
#     if date_obj is None:
#         latest_date_in_db = db.query(func.max(AttendanceDB.attendance_date)).scalar()
#         if latest_date_in_db:
#             date_obj = latest_date_in_db
#             print(f"DEBUG: No valid date_filter provided or found data for it. Defaulting to latest date in DB: {date_obj}")
#         else:
#             print("DEBUG: No attendance data found in the database. Returning empty grid.")
#             return [] # No data in DB at all

#     # --- Employee Data (to get all employees for the date) ---
#     employee_base_query = db.query(
#         EmployeeDB.emp_id,
#         EmployeeDB.full_name,
#         Dept.dept_name,
#         EmployeeDB.gender
#     ).outerjoin(Dept, EmployeeDB.dept_id == Dept.dept_id)

#     employee_filtered_results = employee_base_query.all()
#     employee_ids_in_filter = [emp.emp_id for emp in employee_filtered_results]
#     employee_data_map = {emp.emp_id: {'full_name': emp.full_name, 'dept_name': emp.dept_name, 'gender': emp.gender} for emp in employee_filtered_results}

#     if not employee_ids_in_filter:
#         print(f"DEBUG: No employees found for date {date_obj} after initial filter.")
#         return [] # Return empty list if no employees

#     # --- Fetching Attendance Records directly from DB, including status ---
#     attendance_query = db.query(
#         AttendanceDB.emp_id,
#         AttendanceDB.attendance_status, # Fetch attendance status directly
#         func.min(case((AttendanceDB.punch_type == 'punch_in', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_in_time_str'),
#         func.max(case((AttendanceDB.punch_type == 'punch_out', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_out_time_str')
#     ).filter(
#         AttendanceDB.attendance_date == date_obj,
#         AttendanceDB.emp_id.in_(employee_ids_in_filter)
#     ).group_by(
#         AttendanceDB.emp_id,
#         AttendanceDB.attendance_status # Group by status as well
#     )

#     attendance_results = attendance_query.all()
#     print(f"DEBUG: Raw attendance results for {date_obj}: {attendance_results}") # NEW DEBUG PRINT
#     attendance_map = {}
#     for rec in attendance_results:
#         attendance_map[rec.emp_id] = {
#             'status': rec.attendance_status,
#             'punch_in_time_str': rec.punch_in_time_str,
#             'punch_out_time_str': rec.punch_out_time_str
#         }

#     # --- Prepare FrontendAttendanceRecord list ---
#     calculated_statuses: List[FrontendAttendanceRecord] = []
#     # for emp_id, emp_details in employee_data_map.items():
#     #     attendance_data = attendance_map.get(emp_id)
        
#     #     status = "Absent" # Default status if no attendance record is found for the date
#     #     punch_in_time_str = None
#     #     punch_out_time_str = None
#     #     late_by_display = None

#     #     if attendance_data:
#     #         status = attendance_data['status']
#     #         punch_in_time_str = attendance_data['punch_in_time_str']
#     #         punch_out_time_str = attendance_data['punch_out_time_str']
            
#     #         # Recalculate late_by if original status from DB is 'Late' or 'OnTime' (and punch_in is available)
#     #         # This is specifically for the 'late_by' field, not overriding the DB status
            
#     #         # if (status.lower() == 'late' or status.lower() == 'ontime') and punch_in_time_str: # Use 'ontime' here
#     #         if status and (status.lower() == 'late' or status.lower() == 'ontime') and punch_in_time_str:
#     #             try:
#     #                 punch_in_time_obj = datetime.strptime(punch_in_time_str, "%H:%M:%S").time()
#     #                 punch_in_dt = datetime.combine(date_obj, punch_in_time_obj)
#     #                 standard_punchin_dt = datetime.combine(date_obj, STANDARD_PUNCHIN_WITH_GRACE)
                    
#     #                 late_by_interval = punch_in_dt - standard_punchin_dt
#     #                 if late_by_interval.total_seconds() > 0: # Only show late_by if genuinely late
#     #                     total_seconds = late_by_interval.total_seconds()
#     #                     hours, remainder = divmod(total_seconds, 3600)
#     #                     minutes, seconds = divmod(remainder, 60)
#     #                     late_by_display = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"
#     #             except ValueError:
#     #                 print(f"Warning: Could not parse punch_in_time_str '{punch_in_time_str}' for emp_id {emp_id} while calculating late_by.")


#     #     calculated_statuses.append(FrontendAttendanceRecord(
#     #         id=emp_id,
#     #         employeeId=emp_id,
#     #         employeeName=emp_details['full_name'],
#     #         department=emp_details['dept_name'],
#     #         gender=emp_details['gender'],
#     #         status=AttendanceStatus(status), # Directly use the status string from DB
#     #         checkInTime=punch_in_time_str,
#     #         checkOutTime=punch_out_time_str,
#     #         late_by=late_by_display,
#     #         date=date_obj
#     #     ))
#     for emp_id, emp_details in employee_data_map.items():
#         attendance_data = attendance_map.get(emp_id)
        
#         status = "Absent" # Default status if no attendance record is found for the date
#         punch_in_time_str = None
#         punch_out_time_str = None
#         late_by_display = None

#         if attendance_data:
#             status = attendance_data['status']
#             punch_in_time_str = attendance_data['punch_in_time_str']
#             punch_out_time_str = attendance_data['punch_out_time_str']
#             if status and (status.lower() == 'late' or status.lower() == 'ontime') and punch_in_time_str:
#                 try:
#                     punch_in_time_obj = datetime.strptime(punch_in_time_str, "%H:%M:%S").time()
#                     punch_in_dt = datetime.combine(date_obj, punch_in_time_obj)
#                     standard_punchin_dt = datetime.combine(date_obj, STANDARD_PUNCHIN_WITH_GRACE)
#                     late_by_interval = punch_in_dt - standard_punchin_dt
#                     if late_by_interval.total_seconds() > 0:
#                         total_seconds = late_by_interval.total_seconds()
#                         hours, remainder = divmod(total_seconds, 3600)
#                         minutes, seconds = divmod(remainder, 60)
#                         late_by_display = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"
#                 except ValueError:
#                     print(f"Warning: Could not parse punch_in_time_str '{punch_in_time_str}' for emp_id {emp_id} while calculating late_by.")

#         # Ensure status is always valid for AttendanceStatus
#         if status not in [e.value for e in AttendanceStatus]:
#             status = "Absent"

#         calculated_statuses.append(FrontendAttendanceRecord(
#             id=emp_id,
#             employeeId=emp_id,
#             employeeName=emp_details['full_name'],
#             department=emp_details['dept_name'],
#             gender=emp_details['gender'],
#             status=AttendanceStatus(status),
#             checkInTime=punch_in_time_str,
#             checkOutTime=punch_out_time_str,
#             late_by=late_by_display,
#             date=date_obj
#         ))
#     # Sort for consistent display
#     calculated_statuses.sort(key=lambda x: x.employeeName)

#     return calculated_statuses
from datetime import datetime, time as dt_time

STANDARD_PUNCHIN_WITH_GRACE = dt_time(8, 45, 0)  # Adjust as per your policy
@app.get("/attendance/records", response_model=List[FrontendAttendanceRecord])
async def get_all_attendance_records_for_grid(
    db: Session = Depends(get_db),
    date_filter: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    employee_name: Optional[str] = Query(None),
    attendance_status: Optional[str] = Query(None)  # <-- Add this line
):
    # Parse date_filter or use latest date in DB
    if date_filter:
        date_obj = datetime.strptime(date_filter, "%Y-%m-%d").date()
    else:
        date_obj = db.query(func.max(AttendanceDB.attendance_date)).scalar()
        if not date_obj:
            return []

    # --- Employee Data (with filters) ---
    employee_query = db.query(
        EmployeeDB.emp_id,
        EmployeeDB.full_name,
        Dept.dept_name,
        EmployeeDB.gender
    ).outerjoin(Dept, EmployeeDB.dept_id == Dept.dept_id)

    if department and department.lower() != 'all':
        try:
            dept_id = int(department)
            employee_query = employee_query.filter(EmployeeDB.dept_id == dept_id)
        except ValueError:
            employee_query = employee_query.filter(func.lower(Dept.dept_name).ilike(f"%{department.lower()}%"))

    if gender and gender.lower() != 'all':
        employee_query = employee_query.filter(func.lower(EmployeeDB.gender) == gender.lower())

    if employee_name:
        employee_query = employee_query.filter(func.lower(EmployeeDB.full_name).ilike(f"%{employee_name.lower()}%"))

    employee_filtered_results = employee_query.all()
    employee_ids_in_filter = [emp.emp_id for emp in employee_filtered_results]
    employee_data_map = {
        emp.emp_id: {
            'full_name': emp.full_name,
            'dept_name': emp.dept_name,
            'gender': emp.gender
        }
        for emp in employee_filtered_results
    }

    if not employee_ids_in_filter:
        return []

    # Fetch attendance records for the date
    attendance_query = db.query(
        AttendanceDB.emp_id,
        func.min(case((AttendanceDB.punch_type == 'Punch In', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_in_time_str'),
        func.max(case((AttendanceDB.punch_type == 'Punch Out', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_out_time_str')
    ).filter(
        AttendanceDB.attendance_date == date_obj,
        AttendanceDB.emp_id.in_(employee_ids_in_filter)
    ).group_by(
        AttendanceDB.emp_id
    )

    attendance_results = attendance_query.all()
    attendance_map = {}
    for rec in attendance_results:
        attendance_map[rec.emp_id] = {
            'punch_in_time_str': rec.punch_in_time_str,
            'punch_out_time_str': rec.punch_out_time_str
        }

    calculated_statuses: List[FrontendAttendanceRecord] = []
    for emp_id, emp_details in employee_data_map.items():
        attendance_data = attendance_map.get(emp_id)
        status = "Absent"
        punch_in_time_str = None
        punch_out_time_str = None
        late_by_display = None

        if attendance_data:
            punch_in_time_str = attendance_data['punch_in_time_str']
            punch_out_time_str = attendance_data['punch_out_time_str']
            if punch_in_time_str:
                punch_in_time_obj = datetime.strptime(punch_in_time_str, "%H:%M:%S").time()
                if punch_in_time_obj <= STANDARD_PUNCHIN_WITH_GRACE:
                    status = "OnTime"
                else:
                    status = "Late"
                    punch_in_dt = datetime.combine(date_obj, punch_in_time_obj)
                    standard_punchin_dt = datetime.combine(date_obj, STANDARD_PUNCHIN_WITH_GRACE)
                    late_by_interval = punch_in_dt - standard_punchin_dt
                    if late_by_interval.total_seconds() > 0:
                        total_seconds = late_by_interval.total_seconds()
                        hours, remainder = divmod(total_seconds, 3600)
                        minutes, seconds = divmod(remainder, 60)
                        late_by_display = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"

        calculated_statuses.append(FrontendAttendanceRecord(
            id=emp_id,
            employeeId=emp_id,
            employeeName=emp_details['full_name'],
            department=emp_details['dept_name'],
            gender=emp_details['gender'],
            status=AttendanceStatus(status),
            checkInTime=punch_in_time_str,
            checkOutTime=punch_out_time_str,
            late_by=late_by_display,
            date=date_obj
        ))

    # --- Apply attendance_status filter if provided ---
    if attendance_status and attendance_status.lower() != "all":
        normalized_status = attendance_status.lower().replace(" ", "")
        calculated_statuses = [
            rec for rec in calculated_statuses
            if rec.status.value.lower().replace(" ", "") == normalized_status
        ]

    calculated_statuses.sort(key=lambda x: x.employeeName)
    return calculated_statuses

# @app.get("/attendance/records", response_model=List[FrontendAttendanceRecord])
# async def get_all_attendance_records_for_grid(
#     db: Session = Depends(get_db),
#     date_filter: Optional[str] = Query(None)
# ):
#     # Parse date_filter or use latest date in DB
#     if date_filter:
#         date_obj = datetime.strptime(date_filter, "%Y-%m-%d").date()
#     else:
#         date_obj = db.query(func.max(AttendanceDB.attendance_date)).scalar()
#         if not date_obj:
#             return []

#     # Get all employees for the filter
#     employee_filtered_results = db.query(EmployeeDB).all()
#     employee_ids_in_filter = [emp.emp_id for emp in employee_filtered_results]
#     employee_data_map = {
#         emp.emp_id: {
#             'full_name': emp.full_name,
#             'dept_name': emp.department_rel.dept_name if emp.department_rel else "",
#             'gender': emp.gender
#         }
#         for emp in employee_filtered_results
#     }

#     if not employee_ids_in_filter:
#         return []

#     # Fetch attendance records for the date
#     attendance_query = db.query(
#         AttendanceDB.emp_id,
#         func.min(case((AttendanceDB.punch_type == 'Punch In', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_in_time_str'),
#         func.max(case((AttendanceDB.punch_type == 'Punch Out', text("CAST(attendance.time AS TEXT)")), else_=None)).label('punch_out_time_str')
#     ).filter(
#         AttendanceDB.attendance_date == date_obj,
#         AttendanceDB.emp_id.in_(employee_ids_in_filter)
#     ).group_by(
#         AttendanceDB.emp_id
#     )

#     attendance_results = attendance_query.all()
#     attendance_map = {}
#     for rec in attendance_results:
#         attendance_map[rec.emp_id] = {
#             'punch_in_time_str': rec.punch_in_time_str,
#             'punch_out_time_str': rec.punch_out_time_str
#         }

#     calculated_statuses: List[FrontendAttendanceRecord] = []
#     for emp_id, emp_details in employee_data_map.items():
#         attendance_data = attendance_map.get(emp_id)
#         status = "Absent"
#         punch_in_time_str = None
#         punch_out_time_str = None
#         late_by_display = None

#         if attendance_data:
#             punch_in_time_str = attendance_data['punch_in_time_str']
#             punch_out_time_str = attendance_data['punch_out_time_str']
#             if punch_in_time_str:
#                 punch_in_time_obj = datetime.strptime(punch_in_time_str, "%H:%M:%S").time()
#                 if punch_in_time_obj <= STANDARD_PUNCHIN_WITH_GRACE:
#                     status = "OnTime"
#                 else:
#                     status = "Late"
#                     punch_in_dt = datetime.combine(date_obj, punch_in_time_obj)
#                     standard_punchin_dt = datetime.combine(date_obj, STANDARD_PUNCHIN_WITH_GRACE)
#                     late_by_interval = punch_in_dt - standard_punchin_dt
#                     if late_by_interval.total_seconds() > 0:
#                         total_seconds = late_by_interval.total_seconds()
#                         hours, remainder = divmod(total_seconds, 3600)
#                         minutes, seconds = divmod(remainder, 60)
#                         late_by_display = f"{int(hours):02}:{int(minutes):02}:{int(seconds):02}"

#         calculated_statuses.append(FrontendAttendanceRecord(
#             id=emp_id,
#             employeeId=emp_id,
#             employeeName=emp_details['full_name'],
#             department=emp_details['dept_name'],
#             gender=emp_details['gender'],
#             status=AttendanceStatus(status),
#             checkInTime=punch_in_time_str,
#             checkOutTime=punch_out_time_str,
#             late_by=late_by_display,
#             date=date_obj
#         ))

#     calculated_statuses.sort(key=lambda x: x.employeeName)
#     return calculated_statuses


# --- NEWLY ADDED ENDPOINT: GET /attendance/{employeeId} ---
@app.get("/stats/late")
def get_late_statistics(db: Session = Depends(get_db)):
    """
    Calculates overall late statistics for the last 30 days.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=30)

    # Fetch status directly from the DB for counts
    late_count_query = db.query(func.count(AttendanceDB.attendance_id)).filter(
        AttendanceDB.attendance_date >= start_date,
        AttendanceDB.attendance_date <= end_date,
        func.lower(AttendanceDB.attendance_status) == 'late'
    )
    late_records_count = late_count_query.scalar() or 0

    # Total attendance records where status is not absent (i.e., present, late, half day, on time)
    total_present_records_query = db.query(func.count(AttendanceDB.attendance_id)).filter(
        AttendanceDB.attendance_date >= start_date,
        AttendanceDB.attendance_date <= end_date,
        func.lower(AttendanceDB.attendance_status).in_(['present', 'late', 'half day', 'ontime']) # Use 'ontime' here
    )
    total_records_considered = total_present_records_query.scalar() or 0

    return {
        "total_records_considered": total_records_considered,
        "late_records": late_records_count,
        "late_percentage": round((late_records_count / total_records_considered) * 100, 2) if total_records_considered > 0 else 0
    }


@app.get("/stats/ontime")
def get_ontime_statistics(db: Session = Depends(get_db)):
    """
    Calculates overall on-time statistics for the last 30 days.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=30)

    # Fetch status directly from the DB for counts
    on_time_count_query = db.query(func.count(AttendanceDB.attendance_id)).filter(
        AttendanceDB.attendance_date >= start_date,
        AttendanceDB.attendance_date <= end_date,
        func.lower(AttendanceDB.attendance_status) == 'ontime' # Use 'ontime' here
    )
    on_time_records_count = on_time_count_query.scalar() or 0

    # Total attendance records where status is not absent (i.e., present, late, half day, on time)
    total_present_records_query = db.query(func.count(AttendanceDB.attendance_id)).filter(
        AttendanceDB.attendance_date >= start_date,
        AttendanceDB.attendance_date <= end_date,
        func.lower(AttendanceDB.attendance_status).in_(['present', 'late', 'half day', 'ontime']) # Use 'ontime' here
    )
    total_records_considered = total_present_records_query.scalar() or 0

    return {
        "total_records_considered": total_records_considered,
        "on_time_records": on_time_records_count,
        "on_time_percentage": round((on_time_records_count / total_records_considered) * 100, 2) if total_records_considered > 0 else 0
    }

@app.get("/stats/departments", response_model=List[DepartmentStats])
def get_department_statistics(db: Session = Depends(get_db)):
    """
    Provides attendance statistics aggregated by department.
    Currently returns total employees per department. Extend this as needed.
    """
    # Fetch total employees per department
    department_employee_counts = db.query(
        Dept.dept_name,
        func.count(EmployeeDB.emp_id).label('total_employees')
    ).join(EmployeeDB, Dept.dept_id == EmployeeDB.dept_id)\
     .group_by(Dept.dept_name)\
     .order_by(Dept.dept_name)\
     .all()

    results = []
    for dept_name, emp_count in department_employee_counts:
        results.append(DepartmentStats(
            departmentName=dept_name,
            totalEmployees=emp_count
            # Add more calculated stats here if your frontend expects them
            # E.g., calculate avg present % for each department from AttendanceDB
        ))
    return results


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
