/*
  Warnings:

  - You are about to drop the column `actionReplyComment` on the `InstagramRule` table. All the data in the column will be lost.
  - You are about to drop the column `actionSendDM` on the `InstagramRule` table. All the data in the column will be lost.
  - You are about to drop the column `enabled` on the `InstagramRule` table. All the data in the column will be lost.
  - You are about to drop the column `matchType` on the `InstagramRule` table. All the data in the column will be lost.
  - You are about to drop the column `replyTemplateComment` on the `InstagramRule` table. All the data in the column will be lost.
  - You are about to drop the column `replyTemplateDM` on the `InstagramRule` table. All the data in the column will be lost.
  - Added the required column `replyMessage` to the `InstagramRule` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InstagramRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "igBusinessId" TEXT NOT NULL,
    "mediaId" TEXT,
    "keyword" TEXT NOT NULL,
    "replyMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_InstagramRule" ("createdAt", "id", "igBusinessId", "keyword", "mediaId", "replyMessage", "updatedAt", "userId") SELECT "createdAt", "id", "igBusinessId", "keyword", "mediaId", "replyTemplateDM", "updatedAt", "userId" FROM "InstagramRule";
DROP TABLE "InstagramRule";
ALTER TABLE "new_InstagramRule" RENAME TO "InstagramRule";
CREATE INDEX "InstagramRule_userId_idx" ON "InstagramRule"("userId");
CREATE INDEX "InstagramRule_igBusinessId_idx" ON "InstagramRule"("igBusinessId");
CREATE INDEX "InstagramRule_mediaId_idx" ON "InstagramRule"("mediaId");
CREATE INDEX "InstagramRule_status_idx" ON "InstagramRule"("status");
CREATE UNIQUE INDEX "InstagramRule_igBusinessId_mediaId_keyword_key" ON "InstagramRule"("igBusinessId", "mediaId", "keyword");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
