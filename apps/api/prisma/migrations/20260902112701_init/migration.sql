-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityCount" INTEGER NOT NULL,
    "ownerCount" INTEGER NOT NULL,
    "filingCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Entity" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "registrationType" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityStatus" TEXT NOT NULL,
    "statusDate" DATETIME,
    "formationDate" DATETIME,
    "businessId" TEXT,
    "globalRegion" TEXT,
    "domesticEntityName" TEXT,
    CONSTRAINT "Entity_domesticEntityName_fkey" FOREIGN KEY ("domesticEntityName") REFERENCES "Entity" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentName" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "percent" REAL NOT NULL,
    CONSTRAINT "Ownership_parentName_fkey" FOREIGN KEY ("parentName") REFERENCES "Entity" ("name") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ownership_childName_fkey" FOREIGN KEY ("childName") REFERENCES "Entity" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityName" TEXT NOT NULL,
    "filingType" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "filingAuthority" TEXT,
    "dueDate" DATETIME NOT NULL,
    "filedDate" DATETIME,
    "status" TEXT NOT NULL,
    CONSTRAINT "Filing_entityName_fkey" FOREIGN KEY ("entityName") REFERENCES "Entity" ("name") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Entity_registrationType_idx" ON "Entity"("registrationType");

-- CreateIndex
CREATE INDEX "Entity_domesticEntityName_idx" ON "Entity"("domesticEntityName");

-- CreateIndex
CREATE INDEX "Ownership_childName_idx" ON "Ownership"("childName");

-- CreateIndex
CREATE UNIQUE INDEX "Ownership_parentName_childName_key" ON "Ownership"("parentName", "childName");

-- CreateIndex
CREATE INDEX "Filing_entityName_idx" ON "Filing"("entityName");
