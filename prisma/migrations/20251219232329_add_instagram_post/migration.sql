-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "shopeeAppId" TEXT,
    "shopeeSecret" TEXT,
    "template" TEXT,
    "automationActive" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "startTime" TEXT NOT NULL DEFAULT '07:00',
    "endTime" TEXT NOT NULL DEFAULT '23:00',
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAutomationRun" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT,
    "chatId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "keywords" TEXT NOT NULL DEFAULT '',
    "negativeKeywords" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "lastMessageSent" DATETIME,
    "productCatIds" TEXT,
    "sortType" INTEGER NOT NULL DEFAULT 2,
    "minDiscountPercent" INTEGER,
    "minRating" REAL,
    "minSales" INTEGER,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rotationEmptyThreshold" INTEGER NOT NULL DEFAULT 3,
    "rotationCooldownMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategoryRotationState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "currentCategoryIndex" INTEGER NOT NULL DEFAULT 0,
    "currentPageByCategory" TEXT NOT NULL DEFAULT '{}',
    "emptyStreakByCategory" TEXT NOT NULL DEFAULT '{}',
    "cooldownUntilByCategory" TEXT NOT NULL DEFAULT '{}',
    "seenOfferKeys" TEXT NOT NULL DEFAULT '[]',
    "seenOfferKeysUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CategoryRotationState_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" INTEGER,
    "tokenType" TEXT,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SentOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "keyword" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "pageId" TEXT,
    "igBusinessId" TEXT,
    "igUsername" TEXT,
    "pageAccessToken" TEXT,
    "userAccessToken" TEXT,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstagramPostCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "igBusinessId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "permalink" TEXT,
    "timestamp" DATETIME,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstagramRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "igBusinessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchType" TEXT NOT NULL DEFAULT 'CONTAINS',
    "keyword" TEXT NOT NULL,
    "mediaId" TEXT,
    "actionSendDM" BOOLEAN NOT NULL DEFAULT true,
    "actionReplyComment" BOOLEAN NOT NULL DEFAULT false,
    "replyTemplateDM" TEXT NOT NULL,
    "replyTemplateComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstagramAutomationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igBusinessId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mediaId" TEXT,
    "ruleId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InstagramAutoReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "igBusinessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "messageTemplate" TEXT NOT NULL DEFAULT 'Olá! Obrigado pelo seu comentário. 🙂',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstagramProcessedComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igBusinessId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "dmSent" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igBusinessId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaType" TEXT,
    "caption" TEXT,
    "mediaUrl" TEXT,
    "permalink" TEXT,
    "thumbnailUrl" TEXT,
    "timestamp" DATETIME,
    "raw" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Group_userId_idx" ON "Group"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryRotationState_groupId_key" ON "CategoryRotationState"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "Log"("userId");

-- CreateIndex
CREATE INDEX "SentOffer_userId_idx" ON "SentOffer"("userId");

-- CreateIndex
CREATE INDEX "SentOffer_groupId_idx" ON "SentOffer"("groupId");

-- CreateIndex
CREATE INDEX "SentOffer_itemId_idx" ON "SentOffer"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SentOffer_userId_groupId_itemId_key" ON "SentOffer"("userId", "groupId", "itemId");

-- CreateIndex
CREATE INDEX "SocialAccount_userId_idx" ON "SocialAccount"("userId");

-- CreateIndex
CREATE INDEX "SocialAccount_provider_idx" ON "SocialAccount"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_userId_provider_key" ON "SocialAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "InstagramPostCache_userId_idx" ON "InstagramPostCache"("userId");

-- CreateIndex
CREATE INDEX "InstagramPostCache_igBusinessId_idx" ON "InstagramPostCache"("igBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPostCache_igBusinessId_mediaId_key" ON "InstagramPostCache"("igBusinessId", "mediaId");

-- CreateIndex
CREATE INDEX "InstagramRule_userId_idx" ON "InstagramRule"("userId");

-- CreateIndex
CREATE INDEX "InstagramRule_igBusinessId_idx" ON "InstagramRule"("igBusinessId");

-- CreateIndex
CREATE INDEX "InstagramRule_mediaId_idx" ON "InstagramRule"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAutomationEvent_commentId_key" ON "InstagramAutomationEvent"("commentId");

-- CreateIndex
CREATE INDEX "InstagramAutomationEvent_igBusinessId_idx" ON "InstagramAutomationEvent"("igBusinessId");

-- CreateIndex
CREATE INDEX "InstagramAutomationEvent_commentId_idx" ON "InstagramAutomationEvent"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAutoReply_igBusinessId_key" ON "InstagramAutoReply"("igBusinessId");

-- CreateIndex
CREATE INDEX "InstagramAutoReply_userId_idx" ON "InstagramAutoReply"("userId");

-- CreateIndex
CREATE INDEX "InstagramAutoReply_igBusinessId_idx" ON "InstagramAutoReply"("igBusinessId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramProcessedComment_commentId_key" ON "InstagramProcessedComment"("commentId");

-- CreateIndex
CREATE INDEX "InstagramProcessedComment_igBusinessId_idx" ON "InstagramProcessedComment"("igBusinessId");

-- CreateIndex
CREATE INDEX "InstagramProcessedComment_commentId_idx" ON "InstagramProcessedComment"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPost_mediaId_key" ON "InstagramPost"("mediaId");

-- CreateIndex
CREATE INDEX "InstagramPost_igBusinessId_idx" ON "InstagramPost"("igBusinessId");

-- CreateIndex
CREATE INDEX "InstagramPost_timestamp_idx" ON "InstagramPost"("timestamp");
