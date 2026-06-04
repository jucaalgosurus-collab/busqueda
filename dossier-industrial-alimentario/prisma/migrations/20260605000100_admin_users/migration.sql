-- E.10: usuarios del panel admin + log de sesiones
-- jucaalgo es admin. Los users solo pueden cambiar su contraseña.

CREATE TABLE IF NOT EXISTS "User" (
  "id"                 TEXT PRIMARY KEY,
  "username"           TEXT NOT NULL UNIQUE,
  "passwordHash"       TEXT NOT NULL,
  "role"               TEXT NOT NULL DEFAULT 'user',
  "displayName"        TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt"        TIMESTAMP(3),
  "lastLoginIp"        TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  "createdBy"          TEXT
);

CREATE INDEX IF NOT EXISTS "User_role_isActive_idx" ON "User" ("role", "isActive");

CREATE TABLE IF NOT EXISTS "SessionLog" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "username"    TEXT NOT NULL,
  "loginAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logoutAt"    TIMESTAMP(3),
  "durationSec" INTEGER,
  "ip"          TEXT,
  "userAgent"   TEXT,
  "country"     TEXT,
  CONSTRAINT "SessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SessionLog_userId_loginAt_idx" ON "SessionLog" ("userId", "loginAt");
CREATE INDEX IF NOT EXISTS "SessionLog_username_loginAt_idx" ON "SessionLog" ("username", "loginAt");
CREATE INDEX IF NOT EXISTS "SessionLog_ip_idx" ON "SessionLog" ("ip");
