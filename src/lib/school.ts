import type { SchoolWorkType } from "@/generated/prisma/client";

export const SCHOOL_TYPE_LABEL: Record<SchoolWorkType, string> = {
  HOMEWORK: "Homework",
  ASSIGNMENT: "Assignment",
  TEST: "Test",
  PROJECT: "Project",
};

export const SCHOOL_TYPES: SchoolWorkType[] = [
  "HOMEWORK",
  "ASSIGNMENT",
  "TEST",
  "PROJECT",
];
