from sqlalchemy import create_engine, Column, Integer, String, Date, Float, ForeignKey, Time # Import Time for consistency
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.schema import PrimaryKeyConstraint, UniqueConstraint, ForeignKeyConstraint
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# DATABASE_URL = "postgresql://user:password@localhost/emp_new"  # <-- Should always be the same!
# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# # Database configuration
# DB_HOST = 'localhost'
# DB_NAME = 'emp_new'
# DB_USER = 'postgres'
# DB_PASSWORD = '1234' # Your actual password

# # URL-encode the password to handle special characters like '@'
# encoded_password = quote_plus(DB_PASSWORD)

# # SQLAlchemy connection string for PostgreSQL
# SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:5432/{DB_NAME}"

# engine = create_engine(
#     SQLALCHEMY_DATABASE_URL,
#     pool_pre_ping=True
# )

# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://postgres:1234@localhost/emp_new"  # <-- Should always be the same!

print("Connecting to database:", DATABASE_URL)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- SQLAlchemy Models ---

class Dept(Base):
    """
    SQLAlchemy model for the 'dept' table.
    Represents departments within the organization.
    """
    __tablename__ = "dept"
    dept_id = Column(Integer, primary_key=True, index=True)
    dept_name = Column(String(255), nullable=False) # Added nullable=False based on DDL

    employees = relationship("EmployeeDB", back_populates="department_rel")
    designations = relationship("DesignationDB", back_populates="department_rel")

class DesignationDB(Base):
    """
    SQLAlchemy model for the 'designation' table.
    Represents job titles/designations within departments.
    """
    __tablename__ = "designation"
    designation_id = Column(Integer, primary_key=True, autoincrement=True) # Added autoincrement based on DDL
    designation_name = Column(String(255), nullable=False) # Added nullable=False based on DDL
    dept_id = Column(Integer, ForeignKey("dept.dept_id"), nullable=False) # Added nullable=False based on DDL

    department_rel = relationship("Dept", back_populates="designations")
    employees = relationship("EmployeeDB", back_populates="designation_rel")

class EmployeeDB(Base):
    """
    SQLAlchemy model for the 'employees' table.
    Represents individual employees with their details.
    Uses composite primary and unique keys, and PostgreSQL partitioning.
    """
    __tablename__ = "employees"
    emp_id = Column(Integer, nullable=False) # Removed primary_key=True here, moved to __table_args__
    full_name = Column(String(255), nullable=False, index=True) # Added nullable=False based on DDL
    gender = Column(String(10)) # Added length based on DDL
    email = Column(String(255), nullable=False) # Added nullable=False based on DDL
    contact_name = Column(String(255), nullable=False) # Added nullable=False based on DDL
    hire_date = Column(Date)
    date_of_birth = Column(Date)
    current_address = Column(String) # TEXT in DB maps to String in SQLAlchemy
    distance_from_office = Column(Float)
    total_exp = Column(Float)
    dept_id = Column(Integer, ForeignKey("dept.dept_id"), nullable=False) # Added nullable=False based on DDL
    designation_id = Column(Integer, ForeignKey("designation.designation_id"), nullable=False) # Added nullable=False based on DDL
    salary = Column(Float)

    __table_args__ = (
        PrimaryKeyConstraint('emp_id', 'dept_id', name='employees_pkey'), # Composite Primary Key
        UniqueConstraint('email', 'dept_id', name='uq_employee_email_dept'), # Composite Unique Constraint
        {'postgresql_partition_by': 'LIST (dept_id)'} # Partitioning
    )

    department_rel = relationship("Dept", back_populates="employees")
    designation_rel = relationship("DesignationDB", back_populates="employees")
    attendance_records = relationship("AttendanceDB", back_populates="employee_rel")


class WorkLocationDB(Base):
    """
    SQLAlchemy model for the 'work_location' table.
    Represents different work locations.
    """
    __tablename__ = "work_location"
    work_location_id = Column(Integer, primary_key=True, autoincrement=True) # Added autoincrement based on DDL
    location_name = Column(String(255), nullable=False, unique=True) # Added nullable=False, unique=True based on DDL

    attendance_records = relationship("AttendanceDB", back_populates="work_location_rel")

class AttendanceDB(Base):
    """
    SQLAlchemy model for the 'attendance' table.
    Records employee attendance, including punch times and location.
    Uses composite primary and foreign keys, and PostgreSQL partitioning.
    """
    __tablename__ = "attendance"
    attendance_id = Column(Integer, nullable=False, autoincrement=True) # Removed primary_key here, moved to __table_args__
    emp_id = Column(Integer, nullable=False) # Removed ForeignKey here, moved to __table_args__
    dept_id = Column(Integer, nullable=False) # Added dept_id for composite FK and partitioning
    attendance_date = Column(Date, nullable=False) # Added nullable=False based on DDL
    punch_type = Column(String(50)) # Added length based on DDL
    time = Column(Time) # CRITICAL CHANGE: Changed from String to Time to match your DB schema!
    work_location_id = Column(Integer, ForeignKey("work_location.work_location_id"))
    attendance_status = Column(String(20), nullable=False) # <--- RE-ADDED THIS CRITICAL LINE

    __table_args__ = (
        PrimaryKeyConstraint('attendance_id', 'attendance_date', name='attendance_pkey'), # Composite Primary Key
        ForeignKeyConstraint( # Composite Foreign Key
            ['emp_id', 'dept_id'],
            ['employees.emp_id', 'employees.dept_id']
        ),
        {'postgresql_partition_by': 'RANGE (attendance_date)'} # Partitioning
    )

    employee_rel = relationship("EmployeeDB", back_populates="attendance_records")
    work_location_rel = relationship("WorkLocationDB", back_populates="attendance_records")

# You generally won't call this in a production environment with existing tables.
def create_db_tables():
    """
    Creates all tables defined in the Base.metadata on the bound engine.
    Use with caution in production environments as it will not handle migrations.
    """
    Base.metadata.create_all(bind=engine)

# Dependency to get a database session for FastAPI
def get_db():
    """
    Provides a database session to FastAPI endpoints.
    Ensures the session is closed after the request is processed.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
