import axios from 'axios';

// Base URL for the FastAPI backend.
// Ensure this matches the host and port where your FastAPI application is running.
const API_BASE_URL = 'http://localhost:8000';

// Create an axios instance with the base URL and default headers.
// This simplifies making requests and ensures consistent headers.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json', // Standard header for JSON payloads
  },
});

// --- Employee API Functions ---

/**
 * Fetches employee data from the backend, with optional filters.
 * @param filters An object containing filter parameters (e.g., gender, department, travelDistanceMin).
 * @returns A promise that resolves to a list of employee data.
 */
export const getEmployees = async (filters: Record<string, any> = {}) => {
  try {
    const response = await api.get('/employees', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error fetching employees:', error);
    // Re-throw the error to allow calling components to handle it.
    throw error;
  }
};

// --- Attendance API Functions ---

/**
 * Fetches attendance trend data (e.g., monthly present/late/absent percentages).
 * @returns A promise that resolves to a list of attendance trend objects.
 */
export const getAttendanceTrends = async () => {
  try {
    const response = await api.get('/attendance/trends');
    return response.data;
  } catch (error) {
    console.error('Error fetching attendance trends:', error);
    throw error;
  }
};

/**
 * Fetches all attendance records for a specific date, formatted for a grid view.
 * If no dateFilter is provided, the backend will default to the latest date with data.
 * Now also accepts gender and travel distance filters.
 * @param dateFilter Optional date string in 'YYYY-MM-DD' format.
 * @param genderFilter Optional gender string ('Male', 'Female', 'all').
 * @param travelDistanceMin Optional minimum travel distance.
 * @param travelDistanceMax Optional maximum travel distance.
 * @returns A promise that resolves to a list of attendance records.
 */
export const getAllAttendanceRecords = async (
  dateFilter?: string,
  genderFilter?: string,
  travelDistanceMin?: number,
  travelDistanceMax?: number
) => {
  try {
    const params: {
      date_filter?: string;
      gender_filter?: string;
      travelDistanceMin?: number;
      travelDistanceMax?: number;
    } = {};
    if (dateFilter) {
      params.date_filter = dateFilter;
    }
    // Only add gender_filter if it's not 'all'
    if (genderFilter && genderFilter.toLowerCase() !== 'all') { // Ensure 'all' is not sent
      params.gender_filter = genderFilter;
    }
    // Only add travelDistanceMin/Max if they are explicitly provided (not undefined/null)
    if (travelDistanceMin !== undefined && travelDistanceMin !== null) {
      params.travelDistanceMin = travelDistanceMin;
    }
    if (travelDistanceMax !== undefined && travelDistanceMax !== null) {
      params.travelDistanceMax = travelDistanceMax;
    }

    const response = await api.get('/attendance/records', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching all attendance records:', error);
    throw error;
  }
};

/**
 * !!! IMPORTANT: MISSING BACKEND ENDPOINT !!!
 * This function attempts to fetch attendance history for a specific employee.
 * However, there is no corresponding endpoint like `/attendance/{employeeId}`
 * defined in your `main.py` (FastAPI backend) code.
 *
 * If you intend to use this functionality, you will need to add a new FastAPI
 * endpoint in `main.py` that handles GET requests to `/attendance/{employeeId}`
 * and returns the attendance history for that employee.
 *
 * Example of what you might add to main.py:
 * @app.get("/attendance/{employee_id}", response_model=List[EmployeeAttendanceHistoryRecord])
 * def get_employee_attendance_history(employee_id: int, db: Session = Depends(get_db)):
 * # ... query database for employee's attendance history ...
 * pass
 */
export const getEmployeeAttendance = async (employeeId: number) => {
  try {
    // This call will likely result in a 404 Not Found error from the backend
    // until the corresponding FastAPI endpoint is implemented.
    const response = await api.get(`/attendance/${employeeId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching attendance for employee ${employeeId}:`, error);
    throw error;
  }
};

// --- Statistics API Functions ---

/**
 * Fetches overall late attendance statistics.
 * @returns A promise that resolves to an object containing late statistics.
 */
export const getLateStatistics = async () => {
  try {
    const response = await api.get('/stats/late');
    return response.data;
  } catch (error) {
    console.error('Error fetching late statistics:', error);
    throw error;
  }
};

/**
 * Fetches overall on-time attendance statistics.
 * @returns A promise that resolves to an object containing on-time statistics.
 */
export const getOntimeStatistics = async () => { // NEW: Added function to fetch on-time stats
  try {
    const response = await api.get('/stats/ontime');
    return response.data;
  } catch (error) {
    console.error('Error fetching on-time statistics:', error);
    throw error;
  }
};


// Export the configured axios instance as the default export.
export default api;
