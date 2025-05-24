import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Grid3X3, Grid2X2, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
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

// No explicit type definition here as this is a .jsx file, but keep in mind the expected structure:
// type AttendanceRecord = {
//   id: number;
//   employeeId: number;
//   employeeName: string;
//   date: string;
//   status: 'OnTime' | 'Late' | 'Absent' | 'Half Day' | 'Present'; // Exact strings from backend
//   checkInTime?: string | null;
//   checkOutTime?: string | null;
//   late_by?: string | null;
//   department: string;
// };

const EmployeeAttendanceGrid = ({ data }) => {
  const [viewType, setViewType] = useState('grid');
  const [gridSize, setGridSize] = useState('3x3');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState(data); // Initialize with data prop
  const itemsPerPage = 6;
  
  // Update filtered data when search query or original data changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(data);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredData(
        data.filter(
          record => 
            record.employeeName.toLowerCase().includes(query) ||
            record.employeeId.toString().includes(query)
        )
      );
    }
    // Reset to first page when search changes
    setCurrentPage(1);
  }, [searchQuery, data]); // Depend on data to re-filter if data prop changes

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // UPDATED: getStatusBadge function to handle all possible status values from backend
  const getStatusBadge = (status) => {
    switch (status) {
      case 'OnTime':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">On Time</Badge>;
      case 'Late':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Late</Badge>;
      case 'Absent':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Absent</Badge>;
      case 'Half Day': // Added for "Half Day" status
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Half Day</Badge>;
      case 'Present': // Added for "Present" status
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Present</Badge>;
      default:
        // Fallback for any unexpected status string
        console.warn(`Unexpected attendance status: ${status}`);
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-200">{status}</Badge>;
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const page = parseInt(e.target.elements.page.value);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const pageNumbersToShow = 5; // Number of page numbers to display directly (excluding first/last/ellipses)
    const half = Math.floor(pageNumbersToShow / 2);

    let startPage = Math.max(1, currentPage - half);
    let endPage = Math.min(totalPages, currentPage + half);

    // Adjust start/end if we're at the beginning or end of the page range
    if (endPage - startPage + 1 < pageNumbersToShow) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, pageNumbersToShow);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - pageNumbersToShow + 1);
      }
    }

    // Add "First" page if not in range and totalPages is large
    if (startPage > 1) {
      items.push(
        <PaginationItem key={1}>
          <PaginationLink isActive={currentPage === 1} onClick={() => handlePageChange(1)}>
            1
          </PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    // Add pages in the calculated range
    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={currentPage === i} onClick={() => handlePageChange(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    // Add "Last" page if not in range and totalPages is large
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
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
            className="bootstrap-compatible-btn"
          >
            Grid View
          </Button>
          <Button 
            variant={viewType === 'table' ? 'default' : 'outline'} 
            size="sm" 
            onClick={() => setViewType('table')}
            className="bootstrap-compatible-btn"
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

      <div className="flex mb-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full"
          />
        </div>
        {totalPages > 1 && (
          <form onSubmit={handleGoToPage} className="ml-4 flex items-center">
            <span className="text-sm mr-2">Go to:</span>
            <Input 
              type="number" 
              name="page" 
              min="1" 
              max={totalPages}
              defaultValue={currentPage}
              className="w-16 h-10"
            />
            <Button type="submit" variant="outline" size="sm" className="ml-2">Go</Button>
          </form>
        )}
      </div>

      {viewType === 'grid' ? (
        <div className={`grid ${gridSize === '2x2' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'} gap-4`}>
          {currentItems.map((record) => (
            <div key={record.id} className="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow bootstrap-card">
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
        <div className="border rounded-lg bootstrap-table-container">
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
                  <TableHead>Late By</TableHead> {/* Re-added Late By header */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((record) => {
                  // This debug log is helpful for confirming the status value at render time
                  console.log(`DEBUG (EmployeeAttendanceGrid): Rendering record ID ${record.id}, Status: "${record.status}"`);
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
        // This div ensures the Pagination component is aligned to the right
        <div className="flex justify-end w-full"> 
          <Pagination className="mt-4"> {/* Added mt-4 for top margin */}
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

              <PaginationItem>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="ml-2"
                >
                  Last
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceGrid;
