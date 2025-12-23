import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.attendee.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.user.deleteMany();
  await prisma.room.deleteMany();

  // Hash passwords
  const studentPassword = await bcrypt.hash('student123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);

  // Create users
  const alice = await prisma.user.create({
    data: {
      id: 'u1',
      name: 'Alice Student',
      email: 'alice@uni.edu',
      password: studentPassword,
      role: UserRole.STUDENT,
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: 'u2',
      name: 'Bob Admin',
      email: 'bob@uni.edu',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  console.log('Created users:');
  console.log('  - Alice Student (alice@uni.edu) - Password: student123');
  console.log('  - Bob Admin (bob@uni.edu) - Password: admin123');

  // Create rooms
  const roomA = await prisma.room.create({
    data: {
      id: 'room-a',
      name: 'Room A (Quiet Study)',
      capacity: 6,
      description: 'Glass-walled room near reference section.',
      features: JSON.stringify(['Whiteboard', 'Power Outlets']),
    },
  });

  const roomB = await prisma.room.create({
    data: {
      id: 'room-b',
      name: 'Room B (Group Project)',
      capacity: 10,
      description: 'Larger room with projector.',
      features: JSON.stringify(['Projector', 'Large Table', 'Whiteboard']),
    },
  });

  console.log('Created rooms:', { roomA, roomB });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
