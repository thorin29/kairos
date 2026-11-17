/**
 * Which records the Activity log follows (v0.733), and the area each shows
 * under. Things a parent sets up or decides, not what the app writes on its
 * own (generated tasks, reading days, synced plans, sessions) and not the
 * everyday lists (groceries). Pure: prisma.ts reads it on every write.
 */
export const ACTIVITY_AREAS: Record<string, string> = {
  User: "People",
  Invite: "People",
  Device: "People",
  Term: "School",
  SchoolBreak: "School",
  BaseSubject: "School",
  Subject: "School",
  ClassType: "School",
  SchoolClass: "School",
  ClassMember: "School",
  Event: "Calendar",
  EventType: "Calendar",
  ExternalCalendar: "Calendar",
  SavedAddress: "Calendar",
  Chore: "Chores",
  ChoreAssignment: "Chores",
  RecurringTask: "Tasks",
  Task: "Tasks",
  ReadingPlan: "Bible",
  TrackerReset: "Bible",
  ManualReadingRun: "Bible",
  Book: "Reading",
  ReadingGoal: "Reading",
  GameProfile: "Game time",
  MoneyEntry: "Money",
  PoolExercise: "Workouts",
  HiitWorkout: "Workouts",
  WarmupRoutine: "Workouts",
  WorkoutRotation: "Workouts",
  PersonProgram: "Workouts",
  SharedPlan: "Workouts",
  WorkoutPause: "Workouts",
  FamilyWod: "Workouts",
  Store: "Shopping",
  Pause: "Settings",
  AppSetting: "Settings",
  CoopProposal: "Family goal",
};

export const ACTIVITY_WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

/** A write the Activity log may record. */
export function activityTracked(model: string | undefined, operation: string): model is string {
  return !!model && model in ACTIVITY_AREAS && ACTIVITY_WRITES.has(operation);
}

/** How a record is named in a sentence ("chore", "event"). */
export const ACTIVITY_NOUNS: Record<string, string> = {
  User: "person",
  Invite: "invite",
  Device: "phone",
  Term: "term",
  SchoolBreak: "school break",
  BaseSubject: "subject",
  Subject: "subject",
  ClassType: "class type",
  SchoolClass: "class",
  ClassMember: "class member",
  Event: "event",
  EventType: "event type",
  ExternalCalendar: "calendar feed",
  SavedAddress: "address",
  Chore: "chore",
  ChoreAssignment: "chore assignment",
  RecurringTask: "repeating task",
  Task: "task",
  ReadingPlan: "reading plan",
  TrackerReset: "Bible tracker start over",
  ManualReadingRun: "reading run",
  Book: "book",
  ReadingGoal: "reading goal",
  GameProfile: "game time settings",
  MoneyEntry: "money entry",
  PoolExercise: "movement",
  HiitWorkout: "workout",
  WarmupRoutine: "warm-up",
  WorkoutRotation: "rotation",
  PersonProgram: "program",
  SharedPlan: "shared plan",
  WorkoutPause: "workout pause",
  FamilyWod: "family workout",
  Store: "store",
  Pause: "pause",
  AppSetting: "setting",
  CoopProposal: "family reward",
};
