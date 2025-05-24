import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Grid3X3, Grid2X2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// Type definition for AttendanceRecord to EXACTLY match backend status strings
type AttendanceRecord = {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  // Ensure these status strings EXACTLY match what your backend sends
  status: 'OnTime' | 'Late' | 'Absent' | 'Half Day' | 'Present'; 
  checkInTime?: string | null; 
  checkOutTime?: string | null; 
  late_by?: string | null; 
  department: string;
};

type GridViewProps = {
  data: readonly AttendanceRecord[] | AttendanceRecord[];
};

const EmployeeAttendanceGrid = ({ data }: GridViewProps) => {
  const [viewType, setViewType] = useState<'grid' | 'table'>('grid');
  const [gridSize, setGridSize] = useState<'2x2' | '3x3'>('3x3');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);

  // getStatusBadge function to handle all possible status values from backend
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OnTime':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">On Time</Badge>;
      case 'Late':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Late</Badge>;
      case 'Absent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Absent</Badge>;
      case 'Half Day':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Half Day</Badge>;
      case 'Present': // Explicitly added for "Present" status
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Present</Badge>;
      default:
        // Fallback for any unexpected status string
        console.warn(`Unexpected attendance status: ${status}`);
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">{status}</Badge>;
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Refactored renderPaginationItems for robustness and correct ellipsis display
  const renderPaginationItems = () => {
    const items = [];
    const maxPageNumbers = 5; // Maximum number of page numbers to show

    let startPage = Math.max(1, currentPage - Math.floor(maxPageNumbers / 2));
    let endPage = Math.min(totalPages, currentPage + Math.floor(maxPageNumbers / 2));

    // Adjust start/end if we're at the beginning or end of the page range
    if (endPage - startPage + 1 < maxPageNumbers) {
      startPage = Math.max(1, endPage - maxPageNumbers + 1);
    }
    if (endPage - startPage + 1 < maxPageNumbers) {
      endPage = Math.min(totalPages, startPage + maxPageNumbers - 1);
    }

    // Always show first page if not in the displayed range
    if (startPage > 1) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink isActive={currentPage === 1} onClick={() => handlePageChange(1)}>
            1
          </PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) { // If there's a gap after page 1
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    // Show pages in the calculated range
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={currentPage === i} onClick={() => handlePageChange(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Always show last page if not in the displayed range
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) { // If there's a gap before the last page
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink isActive={currentPage === totalPages} onClick={() => handlePageChange(totalPages)}>
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Employee Attendance Status</h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant={viewType === 'grid' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewType('grid')}
          >
            Grid View
          </Button>
          <Button 
            variant={viewType === 'table' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewType('table')}
          >
            Table View
          </Button>
          {viewType === 'grid' && (
            <div className="border rounded-md flex">
              <Button 
                variant="ghost" 
                size="sm" 
                className={gridSize === '2x2' ? 'bg-muted' : ''}
                onClick={() => setGridSize('2x2')}
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={gridSize === '3x3' ? 'bg-muted' : ''}
                onClick={() => setGridSize('3x3')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {viewType === 'grid' ? (
        <div className={`grid ${gridSize === '2x2' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'} gap-4`}>
          {currentItems.map((record) => (
            <div key={record.id} className="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{record.employeeName}</h4>
                  <p className="text-sm text-gray-500">ID: {record.employeeId}</p>
                </div>
                {getStatusBadge(record.status)}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm text-gray-500">Department: <span className="text-gray-700">{record.department}</span></p>
                <p className="text-sm text-gray-500">Date: <span className="text-gray-700">{record.date}</span></p>
                {record.checkInTime && (
                  <p className="text-sm text-gray-500">Check-in: <span className="text-gray-700">{record.checkInTime}</span></p>
                )}
                {record.checkOutTime && (
                  <p className="text-sm text-gray-500">Check-out: <span className="text-gray-700">{record.checkOutTime}</span></p>
                )}
                {record.late_by && ( // Display Late By if available
                  <p className="text-sm text-gray-500">Late By: <span className="text-gray-700">{record.late_by}</span></p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <ScrollArea className="h-[calc(100vh-370px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead> {/* Added Status header */}
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Late By</TableHead> {/* Added Late By header */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((record) => {
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium">{record.employeeName}</div>
                        <div className="text-xs text-gray-500">ID: {record.employeeId}</div>
                      </TableCell>
                      <TableCell>{record.department}</TableCell>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell> 
                      <TableCell>{record.checkInTime || '—'}</TableCell>
                      <TableCell>{record.checkOutTime || '—'}</TableCell>
                      <TableCell>{record.late_by || '—'}</TableCell> 
                    </TableRow>
                  );
                })}
                {currentItems.length === 0 && ( // Added check for no items
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No attendance records found for the selected date or filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {totalPages > 1 && (
        // Changed the parent div to be a flex container that justifies content to the end
        // and ensures it takes full width.
        <div className="flex justify-end w-full"> 
          <Pagination className="mt-4"> {/* Moved mt-4 to the Pagination component */}
            <PaginationContent className="flex justify-end"> {/* Added justify-end here */}
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              
              {renderPaginationItems()}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceGrid;
