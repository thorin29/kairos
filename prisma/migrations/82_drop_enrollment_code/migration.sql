-- Retire the enrollment-code path: onboarding is now app-based (POST /auth/join
-- with an invitation code). No code reads or writes this table any longer.
DROP TABLE IF EXISTS "EnrollmentCode";
