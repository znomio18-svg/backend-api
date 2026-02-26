-- Migration: Add password field for admin users
-- This adds an optional password column to support admin authentication

ALTER TABLE "users" ADD COLUMN "password" TEXT;
