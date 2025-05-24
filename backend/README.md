
# Employee Analytics API

This is a FastAPI backend for the Employee Analytics Dashboard.

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the server:
   ```bash
   python main.py
   ```

5. Access the API documentation at http://localhost:8000/docs

## API Endpoints

- GET `/employees` - Get all employees with optional filtering
- GET `/attendance/trends` - Get attendance trends by month
- GET `/attendance/{employee_id}` - Get attendance records for a specific employee
- GET `/stats/late` - Get statistics about late arrivals

## Note

This implementation uses in-memory data for demonstration. In a production environment, you would connect to a database.
