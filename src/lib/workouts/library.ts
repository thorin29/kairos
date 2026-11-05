/**
 * The starting library: general movements with how they're logged, their type
 * (squat, hinge, push…), the equipment they need, bodyweight ladders and a
 * short "how to". Reviewed in the "Workout Library for Review" doc (v0.613).
 *
 * Merging only adds and tags: a movement already in the pool under the same
 * name (ignoring case, plurals and hyphens) in the same category gets the tags
 * and how-to it's missing; nothing is renamed and nothing is removed. Each
 * entry's `key` is stable, so later library versions only add.
 */
import type { MuscleGroup, WorkoutCategory, Metric } from "@/lib/workouts/catalog";

export const PATTERNS = ["SQUAT", "HINGE", "PUSH", "PULL", "CARRY", "CORE", "CONDITIONING", "MOBILITY"] as const;
export type Pattern = (typeof PATTERNS)[number];
export const PATTERN_LABEL: Record<Pattern, string> = {
  SQUAT: "Squat",
  HINGE: "Hinge",
  PUSH: "Push",
  PULL: "Pull",
  CARRY: "Carry",
  CORE: "Core",
  CONDITIONING: "Conditioning",
  MOBILITY: "Mobility",
};

/**
 * A movement's type from its name alone, for one with no tag and no library
 * match ("Sandbag lunge" → SQUAT) (v0.625). The first rule that fits wins, so
 * a leg curl is a hinge and a leg press a squat. Null when nothing fits.
 */
const GUESSES: [RegExp, Pattern][] = [
  [/dead\s*lift|\brdl\b|good\s*morning|hip\s*thrust|bridge|swing|back\s*extension|hyperextension|(leg|hamstring)\s*curl|pull[\s-]*through/i, "HINGE"],
  [/lunge|squat|step[\s-]*up|leg\s*press|split\s*squat/i, "SQUAT"],
  [/plank|sit[\s-]*up|crunch|leg\s*raise|\bab\b|\babs\b|ab\s*wheel|roll[\s-]*out|hollow/i, "CORE"],
  [/\brows?\b|pull|chin|pulldown/i, "PULL"],
  [/press|push[\s-]*up|\bdips?\b|bench/i, "PUSH"],
];
export function guessPattern(name: string): Pattern | null {
  for (const [re, p] of GUESSES) if (re.test(name)) return p;
  return null;
}

/** Household equipment, with the weights or sizes on hand (Admin edits these). */
export type EquipmentItem = { key: string; label: string; have: boolean; sizes: number[]; unit: "lb" | "kg" | "in" | "" };

export const DEFAULT_EQUIPMENT: EquipmentItem[] = [
  { key: "barbell", label: "Barbell and plates", have: true, sizes: [], unit: "lb" },
  { key: "ez_bar", label: "EZ bar", have: true, sizes: [], unit: "lb" },
  { key: "dumbbells", label: "Dumbbells", have: true, sizes: [5, 10, 20, 30, 40, 50], unit: "lb" },
  { key: "kettlebells", label: "Kettlebells", have: true, sizes: [5, 15, 18, 26, 30, 35, 45, 53, 62], unit: "lb" },
  { key: "clubs", label: "Steel clubs", have: true, sizes: [5, 15, 25, 35], unit: "lb" },
  { key: "sandbags", label: "Sandbags", have: true, sizes: [60, 80], unit: "lb" },
  { key: "med_balls", label: "Medicine balls", have: true, sizes: [4, 6, 10, 18], unit: "lb" },
  { key: "slam_ball", label: "Slam ball", have: true, sizes: [30], unit: "lb" },
  { key: "boxes", label: "Plyo boxes", have: true, sizes: [6, 12, 18], unit: "in" },
  { key: "trx", label: "TRX", have: true, sizes: [], unit: "" },
  { key: "pullup_bar", label: "Pull-up bar", have: true, sizes: [], unit: "" },
  { key: "back_ext", label: "Back extension chair", have: true, sizes: [], unit: "" },
  { key: "rower", label: "Concept2 rower", have: true, sizes: [], unit: "" },
  { key: "jump_rope", label: "Jump rope", have: true, sizes: [], unit: "" },
];

export type LibraryMovement = {
  key: string;
  name: string;
  category: WorkoutCategory;
  muscleGroup: MuscleGroup | null;
  pattern: Pattern;
  /** Equipment keys; empty = bodyweight. */
  equipment: string[];
  metric: Metric;
  /** A bodyweight progression and its step (1 = easiest). */
  ladder?: [string, number];
  about: string;
};

type Short = [
  name: string,
  group: MuscleGroup | null,
  pattern: Pattern,
  equipment: string,
  metric: "W" | "R" | "T",
  about: string,
  ladder?: [string, number],
];

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const METRIC: Record<"W" | "R" | "T", Metric> = { W: "WEIGHT", R: "REPS", T: "DURATION" };
const build = (category: WorkoutCategory, rows: Short[]): LibraryMovement[] =>
  rows.map(([name, group, pattern, equipment, metric, about, ladder]) => ({
    key: key(name),
    name,
    category,
    muscleGroup: group,
    pattern,
    equipment: equipment ? equipment.split(",") : [],
    metric: METRIC[metric],
    ladder,
    about,
  }));

const STRENGTH: Short[] = [
  // Barbell
  ["Back squat", "LEGS", "SQUAT", "barbell", "W", "Bar on the upper back, feet shoulder-width. Sit down and back until hips are below knees, then stand up driving through the whole foot."],
  ["Front squat", "LEGS", "SQUAT", "barbell", "W", "Bar across the front of the shoulders, elbows high. Squat down keeping the chest up, then stand."],
  ["Box squat", "LEGS", "SQUAT", "barbell,boxes", "W", "Back squat down to sit briefly on a box behind you, stay tight, then stand up."],
  ["Barbell lunge", "LEGS", "SQUAT", "barbell", "W", "Bar on the back. Step forward, lower the back knee toward the floor, push back up. Alternate legs."],
  ["Deadlift", "DEADLIFT", "HINGE", "barbell", "W", "Bar over mid-foot. Hinge to grip it, flat back, then stand up pushing the floor away. Lower it the same way."],
  ["Romanian deadlift", "DEADLIFT", "HINGE", "barbell", "W", "Stand holding the bar. Push the hips back with soft knees until you feel the hamstrings, then stand. The bar stays close."],
  ["Sumo deadlift", "DEADLIFT", "HINGE", "barbell", "W", "Wide stance, hands inside the knees. Chest up, push the knees out and stand up with the bar."],
  ["Good morning", "LEGS", "HINGE", "barbell", "W", "Bar on the back. Push the hips back and tip the chest forward with a flat back, then stand. Keep it light."],
  ["Hip thrust", "LEGS", "HINGE", "barbell", "W", "Upper back on a bench, bar across the hips. Drive the hips up until level with the shoulders, squeeze, lower."],
  ["Bench press", "CHEST", "PUSH", "barbell", "W", "Lie on the bench, feet planted. Lower the bar to mid-chest, then press it back up over the shoulders."],
  ["Incline bench press", "CHEST", "PUSH", "barbell", "W", "Bench press on a bench tilted up. Lower to the upper chest, press back up."],
  ["Decline bench press", "CHEST", "PUSH", "barbell", "W", "Bench press on a bench tilted down. Lower to the lower chest, press back up."],
  ["Close-grip bench press", "ARMS", "PUSH", "barbell", "W", "Bench press with hands shoulder-width, elbows close to the body. Works the triceps."],
  ["Overhead press", "SHOULDERS", "PUSH", "barbell", "W", "Bar at the shoulders. Squeeze glutes and press it straight overhead, moving the head back out of the way."],
  ["Push press", "SHOULDERS", "PUSH", "barbell", "W", "Overhead press with a quick knee dip and drive to start the bar moving."],
  ["Bent over row", "BACK", "PULL", "barbell", "W", "Hinge forward, flat back. Pull the bar to the lower ribs, lower it with control."],
  ["Pendlay row", "BACK", "PULL", "barbell", "W", "Bent over row from the floor each rep: back flat, pull hard to the chest, set it down."],
  ["Barbell shrug", "BACK", "PULL", "barbell", "W", "Hold the bar at the hips, shrug the shoulders straight up to the ears, lower slowly."],
  ["Barbell curl", "ARMS", "PULL", "barbell", "W", "Elbows at the sides, curl the bar to the shoulders, lower slowly."],
  ["Power clean", "FULL_BODY", "HINGE", "barbell", "W", "From the floor, pull the bar fast, jump and shrug, drop under to catch it on the shoulders in a quarter squat."],
  ["Hang clean", "FULL_BODY", "HINGE", "barbell", "W", "Power clean starting with the bar at the thighs instead of the floor."],
  ["Thruster", "FULL_BODY", "SQUAT", "barbell", "W", "Front squat, and as you stand use the drive to press the bar overhead in one move."],
  // EZ bar
  ["EZ bar curl", "ARMS", "PULL", "ez_bar", "W", "Hold the angled grips, elbows at the sides, curl up, lower slowly."],
  ["EZ bar skull crusher", "ARMS", "PUSH", "ez_bar", "W", "Lie on a bench, bar over the chest. Bend only the elbows to lower it to the forehead, then straighten."],
  ["EZ bar preacher curl", "ARMS", "PULL", "ez_bar", "W", "Upper arms on a preacher pad or incline bench, curl the bar up, lower all the way."],
  // Dumbbells
  ["Dumbbell bench press", "CHEST", "PUSH", "dumbbells", "W", "Lie on a bench with a dumbbell in each hand at the chest, press up until arms are straight."],
  ["Incline dumbbell press", "CHEST", "PUSH", "dumbbells", "W", "Dumbbell press on a bench tilted up."],
  ["Dumbbell fly", "CHEST", "PUSH", "dumbbells", "W", "Lie with dumbbells over the chest, arms slightly bent. Open wide to a stretch, then hug them back together."],
  ["Dumbbell shoulder press", "SHOULDERS", "PUSH", "dumbbells", "W", "Dumbbells at the shoulders, press overhead, lower to the shoulders."],
  ["Arnold press", "SHOULDERS", "PUSH", "dumbbells", "W", "Start palms facing you at the shoulders, rotate them out as you press overhead."],
  ["Lateral raise", "SHOULDERS", "PUSH", "dumbbells", "W", "Arms at the sides, raise the dumbbells out to shoulder height with a slight bend, lower slowly."],
  ["Front raise", "SHOULDERS", "PUSH", "dumbbells", "W", "Raise the dumbbells straight in front to shoulder height, lower slowly."],
  ["Rear delt fly", "SHOULDERS", "PULL", "dumbbells", "W", "Hinge forward, raise the dumbbells out to the sides, squeezing the shoulder blades."],
  ["One-arm dumbbell row", "BACK", "PULL", "dumbbells", "W", "One hand and knee on a bench, row the dumbbell to the hip, lower it all the way."],
  ["Renegade row", "BACK", "PULL", "dumbbells", "W", "Push-up position on two dumbbells. Row one, set it down, row the other. Keep the hips still."],
  ["Dumbbell pullover", "BACK", "PULL", "dumbbells", "W", "Lie across a bench holding one dumbbell over the chest, lower it behind the head with long arms, pull it back."],
  ["Dumbbell shrug", "BACK", "PULL", "dumbbells", "W", "Dumbbells at the sides, shrug the shoulders up, lower slowly."],
  ["Dumbbell curl", "ARMS", "PULL", "dumbbells", "W", "Elbows at the sides, curl the dumbbells up, turning the palms up, lower slowly."],
  ["Hammer curl", "ARMS", "PULL", "dumbbells", "W", "Curl with palms facing each other the whole way."],
  ["Overhead triceps extension", "ARMS", "PUSH", "dumbbells", "W", "Hold one dumbbell overhead with both hands, lower it behind the head by bending the elbows, straighten."],
  ["Triceps kickback", "ARMS", "PUSH", "dumbbells", "W", "Hinge forward, upper arm by the side, straighten the elbow to kick the dumbbell back."],
  ["Dumbbell lunge", "LEGS", "SQUAT", "dumbbells", "W", "Dumbbells at the sides. Step forward, lower the back knee, push back up."],
  ["Bulgarian split squat", "LEGS", "SQUAT", "dumbbells", "W", "Back foot on a bench, dumbbells at the sides. Lower straight down on the front leg, stand up."],
  ["Dumbbell step-up", "LEGS", "SQUAT", "dumbbells,boxes", "W", "Step up onto a box with one foot, stand tall, step down. Alternate or do one side at a time."],
  ["Dumbbell Romanian deadlift", "DEADLIFT", "HINGE", "dumbbells", "W", "Romanian deadlift holding dumbbells in front of the thighs."],
  ["Dumbbell thruster", "FULL_BODY", "SQUAT", "dumbbells", "W", "Dumbbells at the shoulders, squat, and press them overhead as you stand."],
  ["Dumbbell snatch", "FULL_BODY", "HINGE", "dumbbells", "W", "One dumbbell between the feet. Hinge, then drive up fast and punch it overhead in one move."],
  ["Farmer carry", "FULL_BODY", "CARRY", "dumbbells", "W", "Heavy dumbbell in each hand, walk tall with short steps. Log the weight and the distance."],
  // Kettlebells
  ["Kettlebell swing", "FULL_BODY", "HINGE", "kettlebells", "W", "Hike the bell back between the legs, then snap the hips forward to float it to chest height. Arms just guide it."],
  ["Goblet squat", "LEGS", "SQUAT", "kettlebells", "W", "Hold a bell at the chest by the horns, squat between the knees, stand up."],
  ["Kettlebell deadlift", "DEADLIFT", "HINGE", "kettlebells", "W", "Bell between the feet, hinge to grip it with a flat back, stand up."],
  ["Single-leg kettlebell deadlift", "DEADLIFT", "HINGE", "kettlebells", "W", "Bell in one hand, reach it toward the floor as the opposite leg lifts behind you, stand back up."],
  ["Kettlebell clean", "FULL_BODY", "HINGE", "kettlebells", "W", "Swing the bell back, then pull it up close and let it roll onto the forearm at the shoulder."],
  ["Kettlebell clean and press", "FULL_BODY", "PUSH", "kettlebells", "W", "Clean the bell to the shoulder, then press it overhead."],
  ["Kettlebell press", "SHOULDERS", "PUSH", "kettlebells", "W", "Bell racked at the shoulder, press it overhead, lower to the rack."],
  ["Kettlebell snatch", "FULL_BODY", "HINGE", "kettlebells", "W", "Swing back, drive the hips and pull the bell straight overhead, punching through at the top."],
  ["Kettlebell high pull", "BACK", "PULL", "kettlebells", "W", "Swing, and at the top pull the bell to the chest with the elbow high."],
  ["Kettlebell row", "BACK", "PULL", "kettlebells", "W", "Hinge forward, row the bell to the hip, lower it."],
  ["Turkish get-up", "FULL_BODY", "CORE", "kettlebells", "W", "Lie down holding the bell straight up. Stand up step by step keeping it overhead and your eyes on it, then reverse. Reps are each side."],
  ["Kettlebell windmill", "CORE", "CORE", "kettlebells", "W", "Bell overhead, feet angled. Push the hip out and slide the other hand down the leg, keeping the bell arm vertical."],
  ["Kettlebell halo", "SHOULDERS", "MOBILITY", "kettlebells", "W", "Hold a light bell upside down by the horns and circle it around the head. Change direction each set."],
  ["Front rack carry", "FULL_BODY", "CARRY", "kettlebells", "W", "Bells racked at the shoulders, walk tall. Log the weight and the distance."],
  ["Suitcase carry", "CORE", "CARRY", "kettlebells", "W", "One heavy bell in one hand, walk without leaning. One hand per set, switching each set. Log the weight and the distance."],
  ["Overhead carry", "CORE", "CARRY", "kettlebells", "W", "One bell locked out overhead, walk tall without leaning. One hand per set, switching each set. Log the weight and the distance."],
  // Steel clubs
  ["Club mill", "SHOULDERS", "MOBILITY", "clubs", "W", "Club behind the head, swing it around and down the front, then back over the other shoulder. Alternate sides."],
  ["Shield cast", "SHOULDERS", "MOBILITY", "clubs", "W", "Club upright at the chest, drop it behind one shoulder and bring it back round the other side to the chest."],
  ["Club swipe", "CORE", "CORE", "clubs", "W", "Club at the shoulder, swing it across and down like an axe, turning the hips, then back up."],
  ["Club front raise", "SHOULDERS", "PUSH", "clubs", "W", "Hold the club by the handle, raise it in front to shoulder height with a straight arm."],
  ["Club torch press", "SHOULDERS", "PUSH", "clubs", "W", "Club held upright like a torch at the shoulder, press it overhead keeping it vertical."],
  ["Club order squat", "LEGS", "SQUAT", "clubs", "W", "Hold the club upright at the chest with both hands and squat."],
  // Sandbags
  ["Sandbag carry", "FULL_BODY", "CARRY", "sandbags", "W", "Hug the bag to the chest or carry it on a shoulder and walk. Log the weight and the distance."],
  ["Sandbag clean", "FULL_BODY", "HINGE", "sandbags", "W", "Bag on the floor, hinge to grab it, pull it into the lap, then stand and drive it up to the chest."],
  ["Sandbag squat", "LEGS", "SQUAT", "sandbags", "W", "Hug the bag at the chest and squat."],
  ["Sandbag over shoulder", "FULL_BODY", "HINGE", "sandbags", "W", "Lift the bag from the floor and throw it over one shoulder. Alternate sides."],
  // TRX
  ["TRX row", "BACK", "PULL", "trx", "R", "Lean back holding the handles, body straight. Pull the chest to the hands. Walk the feet forward to make it harder.", ["row", 1]],
  ["TRX Y-raise", "SHOULDERS", "PULL", "trx", "R", "Lean back, arms straight, raise them into a Y overhead, lower with control."],
  ["TRX push-up", "CHEST", "PUSH", "trx", "R", "Hands in the handles, body straight, lower the chest between the hands and press back up."],
  ["TRX chest fly", "CHEST", "PUSH", "trx", "R", "Lean forward on the handles with arms straight, open them wide, then pull them back together."],
  ["TRX biceps curl", "ARMS", "PULL", "trx", "R", "Lean back, palms up, curl the body up toward the handles bending only the elbows."],
  ["TRX triceps extension", "ARMS", "PUSH", "trx", "R", "Lean forward, elbows bent by the head, straighten the arms to push the body back."],
  ["TRX assisted pistol squat", "LEGS", "SQUAT", "trx", "R", "Hold the handles, one leg out in front, squat down on the other and stand, using the straps as little as you can.", ["pistol", 1]],
  ["TRX hamstring curl", "LEGS", "HINGE", "trx", "R", "Lie on your back with heels in the foot cradles, lift the hips and curl the heels to the glutes."],
  ["TRX fallout", "CORE", "CORE", "trx", "R", "Lean on the handles in a plank, let the arms go forward overhead, pull back without bending at the hips."],
  ["TRX pike", "CORE", "CORE", "trx", "R", "Feet in the cradles in a push-up position, lift the hips up into a pike, lower back."],
  ["TRX Pallof press", "CORE", "CORE", "trx", "R", "Stand side-on to the anchor, both handles at the chest, leaning slightly into the strap. Press straight out, hold 2 seconds without turning, bring back. Reps are each side."],
  // Medicine ball and slam ball strength
  ["Chest pass", "CHEST", "PUSH", "med_balls", "R", "Ball at the chest, push it hard to a partner or a wall and catch it back."],
  ["Rotational throw", "CORE", "CORE", "med_balls", "R", "Side-on to a wall, turn away, then throw the ball into the wall with a fast turn of the hips. Both sides."],
  ["Sit-up throw", "CORE", "CORE", "med_balls", "R", "Sit-up holding the ball overhead, throw it to a partner or a wall at the top, catch and go down."],
  ["Rotational slam", "CORE", "CORE", "slam_ball", "R", "Lift the ball over one shoulder and slam it down outside the opposite foot. Alternate sides."],
  // Pull-up bar
  ["Dead hang", "BACK", "PULL", "pullup_bar", "T", "Hang from the bar with straight arms and active shoulders. Log the time.", ["pull-up", 1]],
  ["Scapular pull-up", "BACK", "PULL", "pullup_bar", "R", "From a hang, pull the shoulders down and back without bending the arms, then relax.", ["pull-up", 2]],
  ["Negative pull-up", "BACK", "PULL", "pullup_bar", "R", "Jump or step to the top with the chin over the bar, then lower as slowly as you can.", ["pull-up", 3]],
  ["Pull-up", "BACK", "PULL", "pullup_bar", "R", "Hang with palms facing away, pull until the chin is over the bar, lower all the way.", ["pull-up", 4]],
  ["Chin-up", "BACK", "PULL", "pullup_bar", "R", "Pull-up with palms facing you.", ["pull-up", 4]],
  ["Weighted pull-up", "BACK", "PULL", "pullup_bar,dumbbells", "W", "Pull-up with a dumbbell held between the feet or on a belt.", ["pull-up", 5]],
  ["Hanging knee raise", "CORE", "CORE", "pullup_bar", "R", "Hang from the bar and pull the knees to the chest without swinging.", ["hanging core", 1]],
  ["Hanging leg raise", "CORE", "CORE", "pullup_bar", "R", "Hang and lift straight legs to hip height or higher.", ["hanging core", 2]],
  ["Toes-to-bar", "CORE", "CORE", "pullup_bar", "R", "Hang and lift the feet all the way up to touch the bar.", ["hanging core", 3]],
  // Back extension chair
  ["Back extension", "BACK", "HINGE", "back_ext", "R", "Hips on the pad, lower the chest toward the floor with a flat back, lift up until in a straight line."],
  ["Weighted back extension", "BACK", "HINGE", "back_ext,dumbbells", "W", "Back extension holding a weight at the chest."],
  ["Hip extension", "LEGS", "HINGE", "back_ext", "R", "Pad lower so the hips can bend, keep the back flat and lift with the glutes and hamstrings."],
  ["Side bend", "CORE", "CORE", "back_ext", "R", "Lie on your side on the chair, lower the shoulder toward the floor and lift back up. Both sides."],
  ["Back extension hold", "CORE", "CORE", "back_ext", "T", "Hips on the pad, body in a straight line, arms crossed on the chest. Hold. Log the time."],
  // Bodyweight
  ["Incline push-up", "CHEST", "PUSH", "boxes", "R", "Hands on a box or bench, body straight, lower the chest to the edge and push up.", ["push-up", 1]],
  ["Push-up", "CHEST", "PUSH", "", "R", "Hands under the shoulders, body straight from head to heels, chest to the floor and push back up.", ["push-up", 2]],
  ["Decline push-up", "CHEST", "PUSH", "boxes", "R", "Push-up with the feet up on a box.", ["push-up", 3]],
  ["Diamond push-up", "ARMS", "PUSH", "", "R", "Push-up with the hands together under the chest, thumbs and fingers touching.", ["push-up", 4]],
  ["Bench dip", "ARMS", "PUSH", "", "R", "Hands on a bench behind you, legs out, lower by bending the elbows, push back up.", ["dip", 1]],
  ["Dip", "ARMS", "PUSH", "", "R", "On parallel bars or two sturdy chairs, lower until the shoulders are below the elbows, press up.", ["dip", 2]],
  ["Pike push-up", "SHOULDERS", "PUSH", "", "R", "Hips high in an upside-down V, lower the head toward the floor between the hands, press back up."],
  ["Air squat", "LEGS", "SQUAT", "", "R", "Feet shoulder-width, arms forward, squat until the hips are below the knees, stand.", ["squat", 1]],
  ["Jump squat", "LEGS", "SQUAT", "", "R", "Air squat, then jump as high as you can and land softly into the next one.", ["squat", 2]],
  ["Bodyweight lunge", "LEGS", "SQUAT", "", "R", "Step forward and lower the back knee toward the floor, push back up. Alternate legs."],
  ["Box step-up", "LEGS", "SQUAT", "boxes", "R", "Step onto a box with one foot and stand tall, step down. Alternate legs."],
  ["Wall sit", "LEGS", "SQUAT", "", "T", "Back flat on a wall, slide down until the thighs are level, hold. Log the time."],
  ["Glute bridge", "LEGS", "HINGE", "", "R", "On your back, knees bent, drive the hips up and squeeze, lower.", ["bridge", 1]],
  ["Single-leg glute bridge", "LEGS", "HINGE", "", "R", "Glute bridge with one leg lifted.", ["bridge", 2]],
  ["Superman", "BACK", "HINGE", "", "R", "Face down, lift the arms, chest and legs off the floor together, hold a second, lower."],
  ["Plank", "CORE", "CORE", "", "T", "On the forearms and toes, body straight, squeeze everything and hold. Log the time.", ["plank", 1]],
  ["Side plank", "CORE", "CORE", "", "T", "On one forearm and the side of the foot, hips up in a straight line. One side per set, switching each set.", ["plank", 2]],
  ["Hollow hold", "CORE", "CORE", "", "T", "On your back, press the low back down, lift the shoulders and legs a few inches and hold."],
  ["L-sit", "CORE", "CORE", "", "T", "Hands on the floor, parallel bars or chairs, lift the body and hold the legs straight out."],
  ["Sit-up", "CORE", "CORE", "", "R", "On your back, knees bent, sit all the way up, lower with control."],
  ["Russian twist", "CORE", "CORE", "", "R", "Sit leaning back with feet up, turn side to side touching the floor beside the hips. Each touch is a rep."],
  ["Dead bug", "CORE", "CORE", "", "R", "On your back, arms and knees up. Lower the opposite arm and leg toward the floor, back flat, switch."],
  ["Bird dog", "CORE", "CORE", "", "R", "On hands and knees, reach the opposite arm and leg out long, hold a second, switch."],
  ["Crunch", "CORE", "CORE", "", "R", "On your back, knees bent, hands by the ears. Curl the shoulders off the floor, pause, lower."],
  ["Reverse crunch", "CORE", "CORE", "", "R", "On your back, knees bent and up. Curl the hips off the floor, bringing the knees toward the chest, lower slowly."],
  ["Bicycle crunch", "CORE", "CORE", "", "R", "On your back, hands by the ears. Bring one elbow toward the opposite knee as the other leg straightens, switch. Each side is a rep."],
  ["V-up", "CORE", "CORE", "", "R", "Lie flat, arms overhead. Lift the arms and straight legs together to touch the toes, lower with control."],
  ["Flutter kick", "CORE", "CORE", "", "R", "On your back, hands under the hips, legs straight and just off the floor. Kick them up and down in small, quick moves. Each four-count is a rep."],
  ["McGill curl-up", "CORE", "CORE", "", "R", "On your back, one knee bent, hands under the low back. Lift the head and shoulders just off the floor as one piece, hold 10 seconds, lower. Each hold is a rep."],
];

const CONDITIONING: Short[] = [
  ["Ball slam", "FULL_BODY", "CONDITIONING", "slam_ball", "R", "Lift the ball overhead on your toes and slam it into the floor as hard as you can. Squat to pick it up."],
  ["Over-shoulder toss", "FULL_BODY", "HINGE", "slam_ball", "R", "Pick the ball up from the floor and throw it back over one shoulder. Alternate sides."],
  ["Wall ball", "FULL_BODY", "SQUAT", "med_balls", "R", "Ball at the chest, squat, and as you stand throw it to a target high on the wall. Catch and go into the next squat."],
  ["Overhead throw", "FULL_BODY", "CONDITIONING", "med_balls", "R", "Ball overhead, throw it forward as far as you can, chase it, repeat."],
  ["Mountain climber", "FULL_BODY", "CONDITIONING", "", "R", "Push-up position, drive the knees to the chest one after the other, fast. Each knee is a rep."],
  ["Burpee", "FULL_BODY", "CONDITIONING", "", "R", "Drop the chest to the floor, push up, jump the feet in and jump up with a clap overhead."],
  ["Box jump", "LEGS", "SQUAT", "boxes", "R", "Swing the arms and jump onto the box, landing softly. Stand tall, step down."],
  ["Bear crawl", "FULL_BODY", "CARRY", "", "R", "On hands and toes with knees just off the floor, crawl forward. Reps are lengths."],
  ["Jump rope", "FULL_BODY", "CONDITIONING", "jump_rope", "T", "Small, quick hops on the balls of the feet, wrists turning the rope. Log the time."],
  ["Shuttle run", "LEGS", "CONDITIONING", "", "R", "Sprint to a line, touch it, sprint back. Each length is a rep."],
];

const MOBILITY: Short[] = [
  ["Inchworm", "FULL_BODY", "MOBILITY", "", "R", "From standing, walk the hands out to a push-up position, then walk the feet up to the hands."],
  ["World's greatest stretch", "FULL_BODY", "MOBILITY", "", "R", "Lunge forward, put the same-side elbow to the floor inside the foot, then rotate that arm to the ceiling. Both sides."],
  ["90/90 hip switch", "LEGS", "MOBILITY", "", "R", "Sit with both knees bent at 90 degrees to one side, then rotate the knees to the other side."],
  ["Cat-cow", "BACK", "MOBILITY", "", "R", "On hands and knees, round the back up, then let it sag and lift the chest."],
  ["Thoracic rotation", "BACK", "MOBILITY", "", "R", "On hands and knees, hand behind the head, rotate the elbow down and then up to the ceiling."],
  ["Hip flexor stretch", "LEGS", "MOBILITY", "", "T", "Half-kneeling, squeeze the back glute and shift forward until the front of the hip stretches. Hold each side."],
  ["Couch stretch", "LEGS", "MOBILITY", "", "T", "Back knee on the floor against a wall with the shin up the wall, front foot forward, sit tall. Hold each side."],
  ["Arm circles", "SHOULDERS", "MOBILITY", "", "R", "Arms out to the sides, small circles getting bigger, then reverse."],
  ["Leg swings", "LEGS", "MOBILITY", "", "R", "Hold a wall, swing one leg forward and back, then side to side. Both legs."],
];

export const LIBRARY: readonly LibraryMovement[] = [
  ...build("WEIGHTS", STRENGTH),
  ...build("HIIT", CONDITIONING),
  ...build("STRETCHING", MOBILITY),
];

/** Name match for merging: case, plurals, hyphens and spaces ignored. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 2 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
}

export type PoolForMerge = { id: string; name: string; category: string; libraryKey: string | null; ownerId?: string | null };

/**
 * What adding the library would do: movements to create, and existing shared
 * pool movements with the same name (in any category: a plank may already be
 * under Isometric) to tag in place. Personal movements are left alone.
 */
export function planLibraryMerge(
  pool: readonly PoolForMerge[],
  library: readonly LibraryMovement[] = LIBRARY,
): { add: LibraryMovement[]; tag: { id: string; entry: LibraryMovement }[] } {
  const taken = new Set(pool.map((p) => p.libraryKey).filter((k): k is string => !!k));
  const byName = new Map<string, PoolForMerge[]>();
  for (const p of pool) {
    if (p.ownerId) continue;
    const k = nameKey(p.name);
    byName.set(k, [...(byName.get(k) ?? []), p]);
  }
  const add: LibraryMovement[] = [];
  const tag: { id: string; entry: LibraryMovement }[] = [];
  for (const e of library) {
    const hits = byName.get(nameKey(e.name)) ?? [];
    if (hits.length) {
      for (const h of hits) if (!h.libraryKey) tag.push({ id: h.id, entry: e });
    } else if (!taken.has(e.key)) {
      add.push(e);
    }
  }
  return { add, tag };
}

export { watchUrl } from "@/lib/workouts/watch";
