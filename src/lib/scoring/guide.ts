/**
 * "How scoring works", in plain words, with the live numbers filled in. One
 * source for the web page (/scoring) and the phone (GET /api/v1/scoring/guide),
 * so the explanation can't drift from the rules or from each other.
 *
 * Dependency-free apart from the constants it quotes. If a rule changes, change
 * the words here in the same release (docs/SCORING.md lists every rule).
 */
import { CLEAN_DAY_STAGES, DEEPEN_GROWTH } from "@/lib/companions";
import { WEEK_GROWTH } from "@/lib/companions-growth";
import { XP_PER_EFFORT, TEST_SCORE_BONUS_XP, SPORT_LIFE_XP } from "@/lib/scoring/progression";

export type GuideSection = { title: string; lines: string[] };

export function scoringGuide(opts: { monthTarget: number }): GuideSection[] {
  const juvenile = CLEAN_DAY_STAGES[1];
  const adult = CLEAN_DAY_STAGES[2];
  return [
    {
      title: "Three things you build",
      lines: [
        "Your level goes up with everything you finish.",
        "Your character grows when you finish your list each day.",
        "This month counts toward the family goal.",
      ],
    },
    {
      title: "Your level",
      lines: [
        `Every task you finish earns XP right away. A chore earns ${XP_PER_EFFORT} XP for each point of effort, from 1 to 5. A workout, a Bible reading, school work or any other task earns ${XP_PER_EFFORT} XP.`,
        `A test earns up to ${TEST_SCORE_BONUS_XP} XP more, depending on your score.`,
        `Reading a book, reading your own Bible plan and showing up to a team practice or game earn a little XP too (${SPORT_LIFE_XP} XP for each practice or game).`,
        "Each level takes a little more XP than the one before.",
      ],
    },
    {
      title: "Your five skills",
      lines: [
        "Chores: the chores you finish.",
        "Strength: workouts. A practice or game you confirm counts as that day's workout.",
        "Wisdom: the family Bible reading and your own Bible reading.",
        "Scholar: school work, tests and books you read.",
        "Life: other tasks, and team practices and games.",
        "Your class is the skill you do the most of compared to the rest of the family.",
      ],
    },
    {
      title: "Your character",
      lines: [
        "Each day, your character grows by how much of that day's list you finished. All of it adds 1. Most of it, say 80%, adds 0.8.",
        "Today's growth shows straight away in a lighter colour. It can still change today if something is unchecked or added, and turns solid tomorrow.",
        `A week where you finish everything adds ${WEEK_GROWTH} more when the week ends.`,
        `It becomes a juvenile at ${juvenile} and an adult at ${adult}.`,
        "The colours show what you did to grow it.",
      ],
    },
    {
      title: "Eggs",
      lines: [
        "One thing grows at a time. An egg only appears once your character is an adult.",
        `Then you choose: hatch the egg for a new character, or make this one shine first by growing it ${DEEPEN_GROWTH} more. When it shines, the egg is back.`,
        "Which character hatches is a surprise, and never one you already have.",
        "The more of your list you've finished over the last two weeks, the better your chance of a rare one. The egg's glow shows your chances.",
      ],
    },
    {
      title: "Switching characters",
      lines: [
        "You can bring back any character you've raised from the gallery.",
        "Each one keeps all the growth it had. Nothing is lost by switching.",
        "What you do today goes to the character you have at the end of the day.",
      ],
    },
    {
      title: "This month",
      lines: [
        "Every day also counts toward the month the same way: a full day is 1, a half day is 0.5.",
        `The family goal is reached when every kid has ${opts.monthTarget} days this month. Then a parent can give the reward the family voted for.`,
      ],
    },
    {
      title: "Streaks and badges",
      lines: [
        "A streak is days in a row where you finished everything.",
        "Perfect weeks and your best week show as badges.",
      ],
    },
  ];
}
