-- CreateTable
CREATE TABLE "ServiceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceName" TEXT NOT NULL DEFAULT 'AIU Library Room Booking',
    "logoUrl" TEXT,
    "contactEmail" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
