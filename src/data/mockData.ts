
// Mock data for the employee analytics dashboard
// In a real implementation, this would come from your FastAPI backend

// Generate random data
const generateEmployeeData = (count: number) => {
  const departments = ['Engineering', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations'];
  const genders = ['Male', 'Female'];
  
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const experienceYears = Math.floor(Math.random() * 15) + 1; // 1-15 years
    const travelKm = Math.floor(Math.random() * 30) + 1; // 1-30 km
    const attendanceRate = Math.floor(Math.random() * 15) + 85; // 85-100%
    const lateArrivalRate = Math.floor(Math.random() * 20); // 0-20%
    
    return {
      id,
      name: `Employee ${id}`,
      gender,
      department,
      experienceYears,
      travelKm,
      attendanceRate,
      lateArrivalRate,
      joinDate: new Date(Date.now() - (experienceYears * 365 * 24 * 60 * 60 * 1000))
    };
  });
};

// Generate mock attendance data for trends
const generateAttendanceData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map(month => {
    // Generate random attendance percentages
    const presentPercent = Math.floor(Math.random() * 15) + 85; // 85-100%
    const latePercent = Math.floor(Math.random() * 10); // 0-10%
    const absentPercent = 100 - presentPercent;
    
    return {
      month,
      presentPercent,
      latePercent,
      absentPercent
    };
  });
};

// Generate daily attendance data
const generateDailyAttendanceData = () => {
  const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
  
  return days.map(day => {
    // Random percentages
    const onTimePercent = Math.floor(Math.random() * 20) + 70; // 70-90%
    const latePercent = Math.floor(Math.random() * 15) + 5; // 5-20%
    const absentPercent = 100 - onTimePercent - latePercent;
    
    // Calculate time patterns
    const earlyMorningPercent = Math.floor(Math.random() * 30) + 20; // 20-50%
    const onTimeArrivalPercent = Math.floor(Math.random() * 30) + 40; // 40-70%
    const lateArrivalPercent = 100 - earlyMorningPercent - onTimeArrivalPercent;
    
    return {
      day,
      onTimePercent,
      latePercent,
      absentPercent,
      timePatterns: {
        earlyMorningPercent,
        onTimeArrivalPercent,
        lateArrivalPercent
      }
    };
  });
};

// Generate 100 mock employees for the frontend demo
// In reality, your application will handle 200,000 employees (2 lakh)
export const mockEmployeeData = generateEmployeeData(100);

// Generate attendance trend data
export const mockAttendanceData = generateAttendanceData();

// Generate daily attendance data
export const mockDailyAttendanceData = generateDailyAttendanceData();

// Define the standard check-in time (9:00 AM)
export const standardCheckInTime = {
  hour: 9,
  minute: 0
};

// Function to check if an employee is late
export const isLate = (checkInHour: number, checkInMinute: number) => {
  if (checkInHour > standardCheckInTime.hour) {
    return true;
  } else if (checkInHour === standardCheckInTime.hour && checkInMinute > standardCheckInTime.minute) {
    return true;
  }
  return false;
};
