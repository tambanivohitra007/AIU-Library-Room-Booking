export interface ParsedUser {
  name: string;
  email: string;
  role?: 'STUDENT' | 'ADMIN';
}

export const parseCSV = (csvText: string): ParsedUser[] => {
  const lines = csvText.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV must contain at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIndex = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');
  const emailIndex = headers.findIndex(h => h === 'email' || h === 'email address');
  const roleIndex = headers.findIndex(h => h === 'role' || h === 'user role');

  if (nameIndex === -1 || emailIndex === -1) {
    throw new Error('CSV must contain "name" and "email" columns');
  }

  const users: ParsedUser[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',').map(v => v.trim());
    
    const name = values[nameIndex];
    const email = values[emailIndex];
    const role = roleIndex !== -1 ? values[roleIndex]?.toUpperCase() : undefined;

    if (name && email) {
      users.push({
        name,
        email,
        role: role === 'ADMIN' ? 'ADMIN' : 'STUDENT',
      });
    }
  }

  return users;
};

export const generateSampleCSV = (): string => {
  return `name,email,role
John Doe,john.doe@example.com,STUDENT
Jane Smith,jane.smith@example.com,STUDENT
Admin User,admin@example.com,ADMIN`;
};
