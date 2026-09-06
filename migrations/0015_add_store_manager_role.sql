-- Add STORE_MANAGER to the role enum
-- PostgreSQL requires adding enum values with ALTER TYPE

ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'STORE_MANAGER' AFTER 'ADMIN';
