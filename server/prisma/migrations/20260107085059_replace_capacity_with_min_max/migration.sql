/*
  Warnings:

  - You are about to drop the column `capacity` on the `Room` table. All the data in the column will be lost.
  - Added the required column `maxCapacity` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minCapacity` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "minCapacity" INTEGER NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "features" TEXT NOT NULL
);
-- Migrate existing data: set minCapacity to 1 and maxCapacity to the old capacity value
INSERT INTO "new_Room" ("description", "features", "id", "name", "minCapacity", "maxCapacity") 
SELECT "description", "features", "id", "name", 1, "capacity" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
