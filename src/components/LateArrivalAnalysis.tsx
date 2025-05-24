import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { mockDailyAttendanceData, standardCheckInTime } from '@/data/mockData'; // Keeping mock data as per your request

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

// Define the type for the lateStatistics prop
interface LateStatisticsData {
  total_late_arrivals: number;
  average_late_minutes: number;
  most_common_late_reason?: string; // Optional, as it might not always be present
  // Add any other properties that your backend's /stats/late endpoint returns here
}

interface LateArrivalAnalysisProps {
  lateStatistics: LateStatisticsData | null; // It can be null initially while loading or if no data
}

const LateArrivalAnalysis: React.FC<LateArrivalAnalysisProps> = ({ lateStatistics }) => {
  // Get the latest day's data from mock data
  const latestDayData = mockDailyAttendanceData[mockDailyAttendanceData.length - 1];
  
  // Prepare pie chart data from mock data
  const attendanceStatusData = [
    { name: 'On Time', value: latestDayData.onTimePercent },
    { name: 'Late', value: latestDayData.latePercent },
    { name: 'Absent', value: latestDayData.absentPercent }
  ];
  
  // Prepare time patterns data from mock data
  const timePatternData = [
    { name: 'Early (Before 8:30 AM)', value: latestDayData.timePatterns.earlyMorningPercent },
    { name: 'On Time (8:30-9:00 AM)', value: latestDayData.timePatterns.onTimeArrivalPercent },
    { name: 'Late (After 9:00 AM)', value: latestDayData.timePatterns.lateArrivalPercent }
  ];
  
  // Prepare trend data for bar chart from mock data
  const trendData = mockDailyAttendanceData.map(day => ({
    day: day.day,
    late: day.latePercent
  }));

  // You can still use the 'lateStatistics' prop here if you want to display its data,
  // for example, in a separate card or section, like this:
  // if (lateStatistics) {
  //   console.log("Received lateStatistics prop:", lateStatistics);
  // }
  
  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">
            Attendance Status (Today)
          </CardTitle>
          <div className="bg-orange-100 text-orange-800 p-2 rounded-md">
            <Clock className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              {/* Displaying mock data. If you want to use lateStatistics.total_late_arrivals, you'd need to adjust */}
              <p className="text-2xl font-bold">{latestDayData.latePercent}%</p>
              <p className="text-sm text-gray-500">Late Arrivals Today</p>
            </div>
            <div className="bg-gray-100 px-3 py-1 rounded-full">
              <p className="text-sm">Standard time: <span className="font-medium">{standardCheckInTime.hour}:{standardCheckInTime.minute.toString().padStart(2, '0')} AM</span></p>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {attendanceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">
            Check-in Time Patterns
          </CardTitle>
          <div className="bg-blue-100 text-blue-800 p-2 rounded-md">
            <Users className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={timePatternData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {timePatternData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Late Arrival Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tickFormatter={(value) => value.replace('Day ', '')} />
              <YAxis label={{ value: 'Late Arrival %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="late" name="Late Arrivals %" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default LateArrivalAnalysis;
