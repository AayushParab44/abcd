import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card"; // FIX: Corrected import syntax for Card and CardContent
import { Separator } from "@/components/ui/separator";
import { Filter, Calendar, XCircle } from 'lucide-react'; // Added XCircle for clear icon
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Define the types for the filters prop
type FiltersProps = {
  filters: {
    gender: string;
    department: string;
    travelDistance: string;
    attendanceStatus: string;
    date: Date | undefined;
  };
  // Define the type for the setFilters dispatch function
  setFilters: React.Dispatch<React.SetStateAction<{
    gender: string;
    department: string;
    travelDistance: string;
    attendanceStatus: string;
    date: Date | undefined;
  }>>;
};

const DashboardFilters = ({ filters, setFilters }: FiltersProps) => {
  // Array of departments, ensuring consistency with your backend's department list.
  // This should ideally be fetched from the backend via an API call (e.g., /departments)
  // to ensure dynamic updates and avoid hardcoding. For now, it's hardcoded.
  const departments = [
    'all',
    'Engineering',
    'Human Resources',
    'Finance',
    'Marketing',
    'Sales',
    'Operations',
    'IT Support',
    'R&D',
    'Customer Support',
    'Legal'
  ];

  // Function to clear all filters
  const handleClearFilters = () => {
    setFilters({
      gender: 'all',
      department: 'all',
      travelDistance: 'all',
      attendanceStatus: 'all',
      date: undefined,
    });
    console.log("DEBUG (DashboardFilters): All filters cleared.");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4"> {/* Added justify-between */}
          <div className="flex items-center">
            <Filter className="h-5 w-5 mr-2 text-gray-500" />
            <h3 className="text-lg font-medium">Filters</h3>
          </div>
          {/* Clear All Filters Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="flex items-center space-x-1"
          >
            <XCircle className="h-4 w-4" />
            <span>Clear All</span>
          </Button>
        </div>
        <Separator className="mb-4" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Gender Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Gender</label>
            <Select
              value={filters.gender}
              onValueChange={(value) => setFilters({ ...filters, gender: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Department Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Department</label>
            <Select
              value={filters.department}
              onValueChange={(value) => setFilters({ ...filters, department: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>
                    {dept === 'all' ? 'All Departments' : dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Travel Distance Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Travel Distance (KM)</label>
            <Select
              value={filters.travelDistance}
              onValueChange={(value) => setFilters({ ...filters, travelDistance: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Distances</SelectItem>
                <SelectItem value="0-5">0-5 KM</SelectItem>
                <SelectItem value="5-10">5-10 KM</SelectItem>
                <SelectItem value="10-15">10-15 KM</SelectItem>
                <SelectItem value="15-20">15-20 KM</SelectItem>
                <SelectItem value="20-100">20+ KM</SelectItem> {/* Changed to 20-100 to reflect "20+" better */}
              </SelectContent>
            </Select>
          </div>
          
          {/* Attendance Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Attendance Status</label>
            <Select
              value={filters.attendanceStatus}
              // Values here must EXACTLY match the strings your backend expects for filtering
              onValueChange={(value) => setFilters({ ...filters, attendanceStatus: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {/* These values should match the 'AttendanceStatus' Enum in main.py exactly */}
                <SelectItem value="OnTime">On Time</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
                <SelectItem value="Half Day">Half Day</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="Present">Present</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.date ? (
                    format(filters.date, "PPP") // Displays date in a localized, readable format
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filters.date}
                  onSelect={(date) => {
                    console.log("DEBUG (DashboardFilters): Date selected:", date ? format(date, 'yyyy-MM-dd') : 'null');
                    // Ensure that if date is null (e.g., clearing selection), it becomes undefined
                    setFilters(prevFilters => ({ ...prevFilters, date: date || undefined }));
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardFilters;
