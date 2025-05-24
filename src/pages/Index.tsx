import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef for managing initial date sync
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import DashboardFilters from '@/components/DashboardFilters';
import EmployeeStats from '@/components/EmployeeStats';
import LoadingState from '@/components/LoadingState';
import LateArrivalAnalysis from '@/components/LateArrivalAnalysis';
import EmployeeAttendanceGrid from '@/components/EmployeeAttendanceGrid';
import { format } from 'date-fns'; // For date formatting

// IMPORT YOUR API FUNCTIONS FROM api.ts
import { getEmployees, getAttendanceTrends, getLateStatistics, getOntimeStatistics, getAllAttendanceRecords } from '../services/api'; // NEW: Imported getOntimeStatistics

const Index = () => {
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(true);

  // Raw data fetched from APIs
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [attendanceTrendData, setAttendanceTrendData] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]); // Raw attendance records for the selected date
  const [lateStatistics, setLateStatistics] = useState<any>(null); // State for late statistics
  const [onTimeStatistics, setOnTimeStatistics] = useState<any>(null); // NEW: State for on-time statistics

  // Filtered data derived from raw data
  const [filteredEmployeeData, setFilteredEmployeeData] = useState<any[]>([]); // Renamed from filteredData for clarity
  const [filteredAttendanceRecords, setFilteredAttendanceRecords] = useState<any[]>([]); // Filtered attendance for the grid

  // State for dashboard filters
  const [filters, setFilters] = useState({
    gender: 'all',
    department: 'all',
    travelDistance: 'all',
    attendanceStatus: 'all',
    date: undefined as Date | undefined // Date filter, initialized as undefined
  });

  // Ref to track if the initial date has been synchronized from the backend's default
  const isInitialDateSynchronized = useRef(false);

  // --- Main Data Fetching Effect ---
  // This effect fetches core data (employees, trends, attendance records for a specific date)
  // It runs when the component mounts or when the 'date', 'gender', or 'travelDistance' filter changes.
  useEffect(() => {
    console.log("DEBUG (Index.tsx): fetchData triggered. Current filters:", filters);
    setIsLoading(true); // Set loading true at the start of the effect

    const fetchData = async () => {
      let hasCachedDataBeenSet = false; // Flag to track if any data was loaded from cache and set to state

      // --- Attempt to load all data from cache first ---
      const cachedEmployees = localStorage.getItem('employeeData');
      if (cachedEmployees) {
        setEmployeeData(JSON.parse(cachedEmployees));
        hasCachedDataBeenSet = true;
      }

      const cachedTrends = sessionStorage.getItem('attendanceTrendData');
      if (cachedTrends) {
        setAttendanceTrendData(JSON.parse(cachedTrends));
        hasCachedDataBeenSet = true;
      }

      const cachedLateStats = sessionStorage.getItem('lateStatistics');
      if (cachedLateStats) {
        setLateStatistics(JSON.parse(cachedLateStats));
        hasCachedDataBeenSet = true;
      }

      const cachedOnTimeStats = sessionStorage.getItem('onTimeStatistics');
      if (cachedOnTimeStats) {
        setOnTimeStatistics(JSON.parse(cachedOnTimeStats));
        hasCachedDataBeenSet = true;
      }

      const dateParam = filters.date ? format(filters.date, 'yyyy-MM-dd') : undefined;
      const genderParam = filters.gender;
      const departmentParam = filters.department; // NEW: Pass department filter to backend
      const attendanceStatusParam = filters.attendanceStatus; // NEW: Pass attendance status filter to backend

      let travelMin: number | undefined;
      let travelMax: number | undefined;
      if (filters.travelDistance !== 'all') {
        const [minStr, maxStr] = filters.travelDistance.split('-');
        travelMin = parseFloat(minStr);
        travelMax = maxStr === '100' ? undefined : parseFloat(maxStr);
      }
      // Updated attendance cache key to include new filters
      const attendanceCacheKey = `attendanceRecords_${dateParam || 'latest'}_${genderParam}_${departmentParam}_${attendanceStatusParam}_${travelMin || 'any'}_${travelMax || 'any'}`;
      const cachedRecords = sessionStorage.getItem(attendanceCacheKey);
      if (cachedRecords) {
        setAttendanceRecords(JSON.parse(cachedRecords));
        hasCachedDataBeenSet = true;
        // Special handling for initial date sync from cached records
        if (!isInitialDateSynchronized.current && filters.date === undefined && JSON.parse(cachedRecords).length > 0 && JSON.parse(cachedRecords)[0].date) {
          const backendDate = new Date(JSON.parse(cachedRecords)[0].date);
          setFilters(prevFilters => ({ ...prevFilters, date: backendDate }));
          isInitialDateSynchronized.current = true;
        }
      }

      // If we found any cached data, set isLoading to false immediately
      if (hasCachedDataBeenSet) {
        setIsLoading(false);
      }

      // --- Now, initiate all API calls in parallel (or sequentially if dependencies) ---
      const fetchPromises = [];

      // Fetch Employee Data (localStorage)
      fetchPromises.push(
        getEmployees().then(employees => {
          setEmployeeData(employees);
          localStorage.setItem('employeeData', JSON.stringify(employees));
        }).catch(error => {
          console.error("Failed to fetch employees from API:", error);
        })
      );

      // Fetch Attendance Trends (sessionStorage)
      fetchPromises.push(
        getAttendanceTrends().then(trends => {
          setAttendanceTrendData(trends);
          sessionStorage.setItem('attendanceTrendData', JSON.stringify(trends));
        }).catch(error => {
          console.error("Failed to fetch attendance trends from API:", error);
        })
      );

      // Fetch Late Statistics (sessionStorage)
      fetchPromises.push(
        getLateStatistics().then(lateStats => {
          setLateStatistics(lateStats);
          sessionStorage.setItem('lateStatistics', JSON.stringify(lateStats));
        }).catch(error => {
          console.error("Failed to fetch late statistics from API:", error);
        })
      );

      // Fetch On-Time Statistics (sessionStorage)
      fetchPromises.push(
        getOntimeStatistics().then(onTimeStats => {
          setOnTimeStatistics(onTimeStats);
          sessionStorage.setItem('onTimeStatistics', JSON.stringify(onTimeStats));
        }).catch(error => {
          console.error("Failed to fetch on-time statistics from API:", error);
        })
      );

      // Fetch Attendance Records (sessionStorage) - NOW INCLUDES DEPARTMENT AND ATTENDANCE STATUS FILTERS
      fetchPromises.push(
        getAllAttendanceRecords(dateParam, genderParam, travelMin, travelMax, departmentParam, attendanceStatusParam).then(allRecords => {
          setAttendanceRecords(allRecords);
          sessionStorage.setItem(attendanceCacheKey, JSON.stringify(allRecords));
          // Re-evaluate initial date sync based on fresh data
          if (!isInitialDateSynchronized.current && filters.date === undefined && allRecords.length > 0 && allRecords[0].date) {
            const backendDate = new Date(allRecords[0].date);
            setFilters(prevFilters => ({ ...prevFilters, date: backendDate }));
            isInitialDateSynchronized.current = true;
          } else if (isInitialDateSynchronized.current && allRecords.length === 0 && filters.date !== undefined) {
             isInitialDateSynchronized.current = false;
          }
        }).catch(error => {
          console.error("Failed to fetch all attendance records from API:", error);
        })
      );

      // Await all promises to ensure all data is fetched/updated before final isLoading=false
      await Promise.allSettled(fetchPromises);
      setIsLoading(false); // Hide loading state once all fetches are done
    };

    fetchData();
  }, [filters.date, filters.gender, filters.travelDistance, filters.department, filters.attendanceStatus]); // Dependencies: Added department and attendanceStatus

  // --- Employee Data Filtering Effect (Client-side) ---
  // Filters employee demographics data based on `gender`, `department`, and `travelDistance`.
  // This is for the EmployeeStats and Demographics charts.
  useEffect(() => {
    if (employeeData.length === 0) {
      setFilteredEmployeeData([]); // Ensure filtered data is empty if raw data is empty
      return;
    }

    let result = [...employeeData];

    if (filters.gender !== 'all') {
      result = result.filter(emp => emp.gender === filters.gender);
    }

    if (filters.department !== 'all') {
      result = result.filter(emp => emp.department === filters.department);
    }

    if (filters.travelDistance !== 'all') {
      const [min, max] = filters.travelDistance.split('-').map(Number);
      result = result.filter(emp => emp.travelKm >= min && emp.travelKm <= max);
    }

    setFilteredEmployeeData(result);
  }, [filters.gender, filters.department, filters.travelDistance, employeeData]); // Dependencies: relevant filters and raw employee data

  // --- Attendance Records Filtering Effect (Client-side for grid view) ---
  // This effect is now simplified as department and attendanceStatus filters are handled by the backend.
  useEffect(() => {
    // attendanceRecords state should now already be filtered by date, gender, travelDistance, department, and attendanceStatus
    // directly from the backend.
    setFilteredAttendanceRecords(attendanceRecords);
    console.log("DEBUG (Index.tsx - Final Filtered Attendance Records for Grid):",
      attendanceRecords.map(r => ({ id: r.id, employeeName: r.employeeName, status: r.status, date: format(new Date(r.date), 'yyyy-MM-dd'), checkInTime: r.checkInTime, checkOutTime: r.checkOutTime, late_by: r.late_by, gender: r.gender, department: r.department }))
    );
  }, [attendanceRecords]); // Dependency: Only attendanceRecords, as other filters are now handled by API call

  // --- Data Transformation Callbacks for Charts ---
  // Using useCallback to memoize these functions, preventing unnecessary re-creation
  // on every render, which can be beneficial for performance, especially with complex data.

  const getDepartmentData = useCallback(() => {
    const deptCount: { [key: string]: number } = {};
    filteredEmployeeData.forEach(emp => {
      deptCount[emp.department] = (deptCount[emp.department] || 0) + 1;
    });
    return Object.keys(deptCount).map(dept => ({
      name: dept,
      value: deptCount[dept]
    }));
  }, [filteredEmployeeData]); // Dependency: filtered employee data

  const getGenderData = useCallback(() => {
    const genderCount = {
      Male: 0,
      Female: 0
    };
    filteredEmployeeData.forEach(emp => {
      if (emp.gender === 'Male' || emp.gender === 'Female') { // Ensure valid gender
        genderCount[emp.gender]++;
      }
    });
    return Object.keys(genderCount).map(gender => ({
      name: gender,
      value: genderCount[gender as keyof typeof genderCount] // Type assertion for correct indexing
    }));
  }, [filteredEmployeeData]); // Dependency: filtered employee data

  const getTravelData = useCallback(() => {
    const travelRanges = [
      { range: '0-5', count: 0 },
      { range: '5-10', count: 0 },
      { range: '10-15', count: 0 },
      { range: '15-20', count: 0 },
      { range: '20+', count: 0 }
    ];

    filteredEmployeeData.forEach(emp => {
      const km = emp.travelKm;
      if (km !== undefined && km !== null) { // Ensure km is a valid number
        if (km <= 5) travelRanges[0].count++;
        else if (km <= 10) travelRanges[1].count++;
        else if (km <= 15) travelRanges[2].count++;
        else if (km <= 20) travelRanges[3].count++;
        else travelRanges[4].count++;
      }
    });
    return travelRanges;
  }, [filteredEmployeeData]); // Dependency: filtered employee data

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Display loading state while data is being fetched
  if (isLoading) {
    return <LoadingState />;
  }

  // Determine if there is any data to display across all relevant sections
  const hasData = filteredEmployeeData.length > 0 ||
                  attendanceTrendData.length > 0 ||
                  filteredAttendanceRecords.length > 0 ||
                  lateStatistics !== null ||
                  onTimeStatistics !== null;

  // NEW: Log the hasData status for debugging
  console.log("DEBUG (Index.tsx): hasData =", hasData);


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Employee Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Analyzing data for {filteredEmployeeData.length} employees
            {filters.date && ` on ${format(filters.date, 'MMMM dd,yyyy')}`}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Dashboard Filters component */}
        <DashboardFilters filters={filters} setFilters={setFilters} />

        {/* Conditional rendering for no data */}
        {!hasData && (
          <div className="text-center p-10 text-gray-600 text-lg border rounded-lg bg-white shadow-sm mt-8">
            No data available for the selected filters. Please adjust your filters or ensure data is present in the database.
          </div>
        )}

        {/* Render content only if data is available */}
        {hasData && (
          <>
            {/* Employee Statistics component */}
            <div className="mt-8">
              <EmployeeStats data={filteredEmployeeData} overallAttendanceStats={onTimeStatistics} />
            </div>

            {/* Tabs for different dashboard sections */}
            <div className="mt-8">
              <Tabs defaultValue="charts" className="w-full">
                {/* Updated TabsList styling for a consistent theme */}
                <TabsList className="grid w-full grid-cols-4 bg-gray-200 text-gray-700 font-medium rounded-lg shadow-sm overflow-hidden">
                  <TabsTrigger value="charts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 ease-in-out">Demographics</TabsTrigger>
                  <TabsTrigger value="attendance" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 ease-in-out">Attendance Trends</TabsTrigger>
                  <TabsTrigger value="lateAnalysis" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 ease-in-out">Late Analysis</TabsTrigger>
                  <TabsTrigger value="attendanceGrid" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 ease-in-out">Attendance Grid</TabsTrigger>
                </TabsList>

                {/* Attendance Trends Tab Content */}
                <TabsContent value="attendance" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Attendance Trends</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={attendanceTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="presentPercent" name="Present %" stroke="#8884d8" />
                          <Line type="monotone" dataKey="latePercent" name="Late %" stroke="#FF8042" />
                          <Line type="monotone" dataKey="absentPercent" name="Absent %" stroke="#FF0000" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Late Arrival Analysis Tab Content */}
                <TabsContent value="lateAnalysis" className="mt-6">
                  {/* Pass lateStatistics to LateArrivalAnalysis component */}
                  <LateArrivalAnalysis lateStatistics={lateStatistics} />
                </TabsContent>

                {/* Attendance Grid Tab Content */}
                <TabsContent value="attendanceGrid" className="mt-6">
                  <Card>
                    <CardContent className="p-6">
                      {/* Pass filteredAttendanceRecords to EmployeeAttendanceGrid component */}
                      <EmployeeAttendanceGrid data={filteredAttendanceRecords} />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Demographics Charts Tab Content */}
                <TabsContent value="charts" className="mt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Department Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Department Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getDepartmentData()}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {getDepartmentData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Gender Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Gender Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getGenderData()}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              <Cell fill="#0088FE" /> {/* Specific colors for Male/Female */}
                              <Cell fill="#00C49F" />
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Travel Distance Distribution Chart */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Travel Distance Distribution</CardTitle>
                      </CardHeader>
                      <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getTravelData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" name="Employees" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
