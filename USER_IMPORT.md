# User Import Feature

## Overview
The user import feature allows administrators to bulk import users via CSV files. All imported users are created with a default password that they should change after their first login.

## Default Password
**Default Password:** `Password123!`

All imported users will have this password initially. Users should be instructed to change their password after first login.

## CSV Format

### Required Columns
- `name` - Full name of the user
- `email` - Email address (must be unique)

### Optional Columns
- `role` - User role: either `STUDENT` or `ADMIN` (defaults to `STUDENT` if not specified)

### Sample CSV
```csv
name,email,role
John Doe,john.doe@example.com,STUDENT
Jane Smith,jane.smith@example.com,STUDENT
Admin User,admin@example.com,ADMIN
```

## Usage Instructions

1. Navigate to the Admin Dashboard
2. Click on the "Users" tab
3. Click the "Import Users" button
4. Download the sample CSV template (optional)
5. Prepare your CSV file with the required columns
6. Upload the CSV file
7. Review the preview of users to be imported
8. Click "Import Users" to complete the import
9. View the import results showing successful and failed imports

## Import Results
After import, you'll see:
- Number of successfully imported users
- Number of failed imports with reasons
- The default password that was assigned to all new users

## Common Import Errors
- **Duplicate email**: User with that email already exists
- **Missing fields**: Name or email is missing
- **Invalid CSV format**: File doesn't contain required columns

## API Endpoint
- **POST** `/api/users/import`
- **Body**: `{ users: Array<{ name: string, email: string, role?: string }> }`
- **Response**: Import results with success and failure details
