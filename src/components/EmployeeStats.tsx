import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Users, Map, ChartBar } from 'lucide-react';

// Define the type for the props expected by this component
type EmployeeStatsProps = {
  data: any[]; // This is filteredEmployeeData from Index.tsx
  // Add overall attendance stats if available from Index.tsx
  overallAttendanceStats?: { // Made optional as it might be null initially
    total_records_considered: number;
    on_time_records: number;
    on_time_percentage: number; // Ensure this is a number
  } | null; // Allow null for initial loading state
};

const EmployeeStats = ({ data, overallAttendanceStats }: EmployeeStatsProps) => {
  // Calculates the average travel distance from the 'data' prop (filtered employees).
  const calculateAverageTravel = () => {
    if (data.length === 0) return 0;
    const totalTravel = data.reduce((acc, emp) => acc + (emp.travelKm || 0), 0); // Use 0 if travelKm is null/undefined
    return (totalTravel / data.length).toFixed(1);
  };

  // The previous calculateAttendanceRate function logic is now inlined directly
  // into the 'stats' array for 'Avg On-Time Attendance' for better readability
  // and direct access to both percentage and raw count.

  const stats = [
    {
      title: "Total Employees",
      value: data.length, // This correctly reflects the count of filtered employees
      icon: Users,
      color: "bg-blue-100 text-blue-800",
    },
    {
      title: "Avg Travel Distance",
      value: `${calculateAverageTravel()} KM`,
      icon: Map,
      color: "bg-purple-100 text-purple-800",
    },
    {
      title: "Avg On-Time Attendance", // Changed title for clarity
      // FIX: Display both percentage and count for Avg On-Time Attendance
      value: overallAttendanceStats && typeof overallAttendanceStats.on_time_percentage === 'number' && !isNaN(overallAttendanceStats.on_time_percentage)
        ? `${overallAttendanceStats.on_time_percentage.toFixed(1)}% (${overallAttendanceStats.on_time_records} records)`
        : '0.0% (0 records)', // Default if stats are null or percentage is invalid
      icon: ChartBar,
      color: "bg-orange-100 text-orange-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className={`p-2 rounded-md ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EmployeeStats;
