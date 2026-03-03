export interface TemplateExercise {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  days: TemplateDay[];
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'ppl',
    name: 'PPL',
    description: 'Push / Pull / Legs — 6 days',
    daysPerWeek: 6,
    days: [
      {
        name: 'Push A',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 8, weight: 60 },
          { name: 'Incline Bench Press', sets: 3, reps: 10, weight: 50 },
          { name: 'Overhead Press', sets: 3, reps: 8, weight: 40 },
          { name: 'Cable Fly', sets: 3, reps: 12, weight: 15 },
          { name: 'Tricep Pushdown', sets: 3, reps: 12, weight: 20 },
        ],
      },
      {
        name: 'Pull A',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: 5, weight: 100 },
          { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 },
          { name: 'Barbell Row', sets: 3, reps: 8, weight: 60 },
          { name: 'Lat Pulldown', sets: 3, reps: 10, weight: 50 },
          { name: 'Barbell Curl', sets: 3, reps: 10, weight: 30 },
        ],
      },
      {
        name: 'Legs A',
        exercises: [
          { name: 'Squat', sets: 4, reps: 6, weight: 80 },
          { name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 70 },
          { name: 'Leg Press', sets: 3, reps: 12, weight: 120 },
          { name: 'Leg Curl', sets: 3, reps: 12, weight: 40 },
          { name: 'Calf Raise', sets: 4, reps: 15, weight: 60 },
        ],
      },
      {
        name: 'Push B',
        exercises: [
          { name: 'Overhead Press', sets: 4, reps: 6, weight: 45 },
          { name: 'Incline Bench Press', sets: 4, reps: 8, weight: 55 },
          { name: 'Cable Fly', sets: 3, reps: 15, weight: 12 },
          { name: 'Tricep Pushdown', sets: 4, reps: 15, weight: 18 },
          { name: 'Skull Crushers', sets: 3, reps: 12, weight: 25 },
        ],
      },
      {
        name: 'Pull B',
        exercises: [
          { name: 'Pull-ups', sets: 4, reps: 6, weight: 0 },
          { name: 'Barbell Row', sets: 4, reps: 6, weight: 65 },
          { name: 'Cable Row', sets: 3, reps: 12, weight: 50 },
          { name: 'Face Pull', sets: 3, reps: 15, weight: 20 },
          { name: 'Hammer Curl', sets: 3, reps: 12, weight: 15 },
        ],
      },
      {
        name: 'Legs B',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, weight: 85 },
          { name: 'Leg Press', sets: 4, reps: 10, weight: 130 },
          { name: 'Leg Extension', sets: 3, reps: 15, weight: 35 },
          { name: 'Leg Curl', sets: 3, reps: 15, weight: 35 },
          { name: 'Calf Raise', sets: 4, reps: 20, weight: 50 },
        ],
      },
    ],
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower',
    description: 'Upper & Lower splits — 4 days',
    daysPerWeek: 4,
    days: [
      {
        name: 'Upper A',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: 8, weight: 60 },
          { name: 'Barbell Row', sets: 4, reps: 8, weight: 60 },
          { name: 'Overhead Press', sets: 3, reps: 10, weight: 40 },
          { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 },
          { name: 'Skull Crushers', sets: 3, reps: 12, weight: 25 },
          { name: 'Barbell Curl', sets: 3, reps: 12, weight: 30 },
        ],
      },
      {
        name: 'Lower A',
        exercises: [
          { name: 'Squat', sets: 4, reps: 6, weight: 80 },
          { name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 70 },
          { name: 'Leg Press', sets: 3, reps: 12, weight: 120 },
          { name: 'Leg Curl', sets: 3, reps: 12, weight: 40 },
          { name: 'Calf Raise', sets: 4, reps: 15, weight: 60 },
        ],
      },
      {
        name: 'Upper B',
        exercises: [
          { name: 'Incline Bench Press', sets: 4, reps: 10, weight: 50 },
          { name: 'Pull-ups', sets: 4, reps: 6, weight: 0 },
          { name: 'Overhead Press', sets: 3, reps: 8, weight: 42 },
          { name: 'Cable Row', sets: 3, reps: 12, weight: 50 },
          { name: 'Tricep Pushdown', sets: 3, reps: 15, weight: 20 },
          { name: 'Hammer Curl', sets: 3, reps: 12, weight: 15 },
        ],
      },
      {
        name: 'Lower B',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: 5, weight: 100 },
          { name: 'Leg Press', sets: 4, reps: 10, weight: 130 },
          { name: 'Romanian Deadlift', sets: 3, reps: 12, weight: 60 },
          { name: 'Leg Extension', sets: 3, reps: 15, weight: 35 },
          { name: 'Calf Raise', sets: 4, reps: 15, weight: 60 },
        ],
      },
    ],
  },
  {
    id: 'full_body',
    name: 'Full Body',
    description: 'Three total-body sessions — 3 days',
    daysPerWeek: 3,
    days: [
      {
        name: 'Full Body A',
        exercises: [
          { name: 'Squat', sets: 3, reps: 5, weight: 80 },
          { name: 'Bench Press', sets: 3, reps: 5, weight: 60 },
          { name: 'Barbell Row', sets: 3, reps: 5, weight: 60 },
          { name: 'Overhead Press', sets: 2, reps: 10, weight: 35 },
          { name: 'Barbell Curl', sets: 2, reps: 12, weight: 25 },
        ],
      },
      {
        name: 'Full Body B',
        exercises: [
          { name: 'Squat', sets: 3, reps: 5, weight: 80 },
          { name: 'Overhead Press', sets: 3, reps: 5, weight: 40 },
          { name: 'Deadlift', sets: 1, reps: 5, weight: 100 },
          { name: 'Pull-ups', sets: 3, reps: 8, weight: 0 },
          { name: 'Dips', sets: 3, reps: 10, weight: 0 },
        ],
      },
      {
        name: 'Full Body C',
        exercises: [
          { name: 'Squat', sets: 3, reps: 8, weight: 70 },
          { name: 'Incline Bench Press', sets: 3, reps: 8, weight: 50 },
          { name: 'Cable Row', sets: 3, reps: 10, weight: 45 },
          { name: 'Lateral Raise', sets: 3, reps: 15, weight: 10 },
          { name: 'Hammer Curl', sets: 3, reps: 12, weight: 14 },
        ],
      },
    ],
  },
  {
    id: 'stronglift_5x5',
    name: 'StrongLifts 5×5',
    description: 'Classic 5×5 strength program — 3 days',
    daysPerWeek: 3,
    days: [
      {
        name: 'Workout A',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, weight: 60 },
          { name: 'Bench Press', sets: 5, reps: 5, weight: 50 },
          { name: 'Barbell Row', sets: 5, reps: 5, weight: 50 },
        ],
      },
      {
        name: 'Workout B',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, weight: 60 },
          { name: 'Overhead Press', sets: 5, reps: 5, weight: 35 },
          { name: 'Deadlift', sets: 1, reps: 5, weight: 80 },
        ],
      },
      {
        name: 'Workout A',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, weight: 62.5 },
          { name: 'Bench Press', sets: 5, reps: 5, weight: 52.5 },
          { name: 'Barbell Row', sets: 5, reps: 5, weight: 52.5 },
        ],
      },
    ],
  },
];
