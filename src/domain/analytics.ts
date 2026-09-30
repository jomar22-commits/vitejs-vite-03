// src/domain/analytics.ts

import type {
  DailyContext,
  HabitOccurrence,
  PointTransaction,
  Task,
  TaskAssignment,
} from "./types";


// ======================================================
// DAILY SUMMARY
// ======================================================

/**
 * Resumen analítico de UN usuario, UN día
 * y UNA dinámica.
 *
 * No se persiste.
 * Se calcula a partir de las fuentes originales.
 */
export interface DailySummary {
  date: string;
  userId: string;
  spaceId: string;

  context: {
    mood?: number;
    energy?: number;

    hasSymptoms: boolean;
    symptomCount: number;

    period?: boolean;
    cycleDay?: number;
  };

  planned: {
    taskCount: number;
    habitCount: number;
    totalCount: number;
  };

  completion: {
    validatedPlannedTasks: number;
    validatedPlannedHabits: number;

    completedCount: number;

    completionRate?: number;
  };

  activity: {
    tasksSubmittedToday: number;
    tasksValidatedToday: number;

    habitsSubmittedToday: number;
    habitsValidatedToday: number;
    habitsMissedToday: number;
  };

  results: {
    pointsEarnedToday: number;
  };
}


// ======================================================
// BUILD DAILY SUMMARY
// ======================================================

export function buildDailySummary(
  date: string,
  userId: string,
  spaceId: string,
  dailyContexts: DailyContext[],
  tasks: Task[],
  taskAssignments: TaskAssignment[],
  habitOccurrences: HabitOccurrence[],
  transactions: PointTransaction[],
): DailySummary {

  // ----------------------------------------------------
  // PERSONAL CONTEXT
  // ----------------------------------------------------

  const context =
    dailyContexts.find(
      (item) =>
        item.userId === userId &&
        item.date === date,
    );


  // ----------------------------------------------------
  // USER TASK ASSIGNMENTS
  // ----------------------------------------------------

  const userAssignments =
    taskAssignments.filter(
      (assignment) =>
        assignment.spaceId === spaceId &&
        assignment.executorUserId === userId,
    );


  // ----------------------------------------------------
  // TASKS PLANNED FOR THIS DAY
  // ----------------------------------------------------

  const plannedTasks =
    tasks.filter((task) => {
      if (
        task.spaceId !== spaceId ||
        !task.dueAt
      ) {
        return false;
      }

      const assignedToUser =
        userAssignments.some(
          (assignment) =>
            assignment.taskId === task.id,
        );

      return (
        assignedToUser &&
        getDateOnly(task.dueAt) === date
      );
    });


  const plannedTaskIds =
    new Set(
      plannedTasks.map(
        (task) => task.id,
      ),
    );


  // ----------------------------------------------------
  // PLANNED TASK COMPLETION
  // ----------------------------------------------------

  /**
   * Aquí preguntamos:
   *
   * De las tareas que estaban planificadas PARA este día,
   * ¿cuántas terminaron siendo validadas?
   *
   * No importa si la validación ocurrió otro día.
   */
  const validatedPlannedTasks =
    userAssignments.filter(
      (assignment) =>
        plannedTaskIds.has(
          assignment.taskId,
        ) &&
        assignment.status === "validated",
    ).length;


  // ----------------------------------------------------
  // HABITS PLANNED FOR THIS DAY
  // ----------------------------------------------------

  const plannedHabits =
    habitOccurrences.filter(
      (occurrence) =>
        occurrence.spaceId === spaceId &&
        occurrence.executorUserId === userId &&
        occurrence.occurrenceDate === date,
    );


  const validatedPlannedHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "validated",
    ).length;


  // ----------------------------------------------------
  // TOTAL PLANNED / COMPLETED
  // ----------------------------------------------------

  const plannedCount =
    plannedTasks.length +
    plannedHabits.length;

  const completedCount =
    validatedPlannedTasks +
    validatedPlannedHabits;


  const completionRate =
    plannedCount > 0
      ? completedCount / plannedCount
      : undefined;


  // ----------------------------------------------------
  // ACTIVITY THAT ACTUALLY HAPPENED TODAY
  // ----------------------------------------------------

  const tasksSubmittedToday =
    userAssignments.filter(
      (assignment) =>
        assignment.submittedAt !== undefined &&
        getDateOnly(
          assignment.submittedAt,
        ) === date,
    ).length;


  const tasksValidatedToday =
    userAssignments.filter(
      (assignment) =>
        assignment.validatedAt !== undefined &&
        getDateOnly(
          assignment.validatedAt,
        ) === date,
    ).length;


  /**
   * Para actividad usamos timestamps reales.
   *
   * Esto es distinto de preguntar si el hábito
   * pertenecía al día consultado.
   */
  const userHabitOccurrences =
    habitOccurrences.filter(
      (occurrence) =>
        occurrence.spaceId === spaceId &&
        occurrence.executorUserId === userId,
    );


  const habitsSubmittedToday =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.submittedAt !== undefined &&
        getDateOnly(
          occurrence.submittedAt,
        ) === date,
    ).length;


  const habitsValidatedToday =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.validatedAt !== undefined &&
        getDateOnly(
          occurrence.validatedAt,
        ) === date,
    ).length;


  /**
   * Actualmente HabitOccurrence no tiene missedAt.
   *
   * Por tanto, "missed" se atribuye a la fecha
   * de la propia ocurrencia.
   *
   * Si posteriormente necesitamos saber cuándo
   * fue marcado como missed, añadiremos missedAt.
   */
  const habitsMissedToday =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.occurrenceDate === date &&
        occurrence.status === "missed",
    ).length;


  // ----------------------------------------------------
  // POINTS EARNED TODAY
  // ----------------------------------------------------

  const pointsEarnedToday =
    transactions
      .filter(
        (transaction) =>
          transaction.userId === userId &&
          transaction.spaceId === spaceId &&
          getDateOnly(
            transaction.createdAt,
          ) === date,
      )
      .reduce(
        (total, transaction) =>
          total + transaction.amount,
        0,
      );


  // ----------------------------------------------------
  // RESULT
  // ----------------------------------------------------

  return {
    date,
    userId,
    spaceId,

    context: {
      mood: context?.mood,
      energy: context?.energy,

      hasSymptoms:
        (context?.symptoms?.length ?? 0) > 0,

      symptomCount:
        context?.symptoms?.length ?? 0,

      period:
        context?.cycle?.period,

      cycleDay:
        context?.cycle?.cycleDay,
    },

    planned: {
      taskCount:
        plannedTasks.length,

      habitCount:
        plannedHabits.length,

      totalCount:
        plannedCount,
    },

    completion: {
      validatedPlannedTasks,
      validatedPlannedHabits,

      completedCount,

      completionRate,
    },

    activity: {
      tasksSubmittedToday,
      tasksValidatedToday,

      habitsSubmittedToday,
      habitsValidatedToday,
      habitsMissedToday,
    },

    results: {
      pointsEarnedToday,
    },
  };
}


// ======================================================
// DATE HELPERS
// ======================================================

function getDateOnly(
  timestamp: string,
): string {
  return timestamp.slice(0, 10);
}
// ======================================================
// PERIOD SUMMARY
// ======================================================

export interface PeriodSummary {
  startDate: string;
  endDate: string;

  userId: string;
  spaceId: string;

  days: {
    total: number;
    withContext: number;
    withPlannedActivity: number;
  };

  planned: {
    tasks: number;
    habits: number;
    total: number;
  };

  completion: {
    validatedTasks: number;
    validatedHabits: number;

    completedTotal: number;

    completionRate?: number;
  };

  punctuality: {
    tasksSubmittedOnTime: number;
    tasksSubmittedLate: number;
    tasksNotSubmitted: number;

    onTimeRate?: number;
  };

  habits: {
    validated: number;
    missed: number;
    rejected: number;
    pending: number;
    submitted: number;
  };

  activity: {
    taskSubmissions: number;
    taskValidations: number;

    habitSubmissions: number;
    habitValidations: number;
  };

  results: {
    pointsEarned: number;
  };

  context: {
    daysWithMood: number;
    averageMood?: number;

    daysWithEnergy: number;
    averageEnergy?: number;

    daysWithSymptoms: number;
    daysWithPeriod: number;
  };
}


// ======================================================
// BUILD PERIOD SUMMARY
// ======================================================

export function buildPeriodSummary(
  startDate: string,
  endDate: string,
  userId: string,
  spaceId: string,
  dailyContexts: DailyContext[],
  tasks: Task[],
  taskAssignments: TaskAssignment[],
  habitOccurrences: HabitOccurrence[],
  transactions: PointTransaction[],
): PeriodSummary {
  if (startDate > endDate) {
    throw new Error(
      "La fecha inicial no puede ser posterior a la fecha final.",
    );
  }


  // ----------------------------------------------------
  // DATE RANGE
  // ----------------------------------------------------

  const dates =
    buildDateRange(
      startDate,
      endDate,
    );


  const dateSet =
    new Set(dates);


  // ----------------------------------------------------
  // PERSONAL CONTEXT
  // ----------------------------------------------------

  const periodContexts =
    dailyContexts.filter(
      (context) =>
        context.userId === userId &&
        dateSet.has(context.date),
    );


  const moodValues =
    periodContexts
      .map((context) => context.mood)
      .filter(
        (value): value is NonNullable<typeof value> =>
          value !== undefined,
      );


  const energyValues =
    periodContexts
      .map((context) => context.energy)
      .filter(
        (value): value is NonNullable<typeof value> =>
          value !== undefined,
      );


  const daysWithSymptoms =
    periodContexts.filter(
      (context) =>
        (context.symptoms?.length ?? 0) > 0,
    ).length;


  const daysWithPeriod =
    periodContexts.filter(
      (context) =>
        context.cycle?.period === true,
    ).length;


  // ----------------------------------------------------
  // USER ASSIGNMENTS
  // ----------------------------------------------------

  const userAssignments =
    taskAssignments.filter(
      (assignment) =>
        assignment.spaceId === spaceId &&
        assignment.executorUserId === userId,
    );


  // ----------------------------------------------------
  // PLANNED TASKS IN PERIOD
  // ----------------------------------------------------

  const plannedTasks =
    tasks.filter((task) => {
      if (
        task.spaceId !== spaceId ||
        !task.dueAt
      ) {
        return false;
      }

      const assignedToUser =
        userAssignments.some(
          (assignment) =>
            assignment.taskId === task.id,
        );

      return (
        assignedToUser &&
        dateSet.has(
          getDateOnly(task.dueAt),
        )
      );
    });


  const plannedTaskIds =
    new Set(
      plannedTasks.map(
        (task) => task.id,
      ),
    );


  const plannedAssignments =
    userAssignments.filter(
      (assignment) =>
        plannedTaskIds.has(
          assignment.taskId,
        ),
    );


  // ----------------------------------------------------
  // TASK COMPLETION
  // ----------------------------------------------------

  const validatedTasks =
    plannedAssignments.filter(
      (assignment) =>
        assignment.status === "validated",
    ).length;


  // ----------------------------------------------------
  // TASK PUNCTUALITY
  // ----------------------------------------------------

  let tasksSubmittedOnTime = 0;
  let tasksSubmittedLate = 0;
  let tasksNotSubmitted = 0;


  for (const assignment of plannedAssignments) {
    const task =
      plannedTasks.find(
        (item) =>
          item.id === assignment.taskId,
      );

    if (!task?.dueAt) {
      continue;
    }

    if (!assignment.submittedAt) {
      tasksNotSubmitted += 1;
      continue;
    }

    if (
      new Date(
        assignment.submittedAt,
      ).getTime() <=
      new Date(
        task.dueAt,
      ).getTime()
    ) {
      tasksSubmittedOnTime += 1;
    } else {
      tasksSubmittedLate += 1;
    }
  }


  const submittedPlannedTasks =
    tasksSubmittedOnTime +
    tasksSubmittedLate;


  /**
   * onTimeRate responde:
   *
   * De las tareas planificadas que sí fueron
   * entregadas, ¿qué proporción llegó a tiempo?
   *
   * Las no entregadas se mantienen como una
   * categoría independiente.
   */
  const onTimeRate =
    submittedPlannedTasks > 0
      ? tasksSubmittedOnTime /
        submittedPlannedTasks
      : undefined;


  // ----------------------------------------------------
  // HABITS PLANNED IN PERIOD
  // ----------------------------------------------------

  const plannedHabits =
    habitOccurrences.filter(
      (occurrence) =>
        occurrence.spaceId === spaceId &&
        occurrence.executorUserId === userId &&
        dateSet.has(
          occurrence.occurrenceDate,
        ),
    );


  const validatedHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "validated",
    ).length;


  const missedHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "missed",
    ).length;


  const rejectedHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "rejected",
    ).length;


  const pendingHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "pending",
    ).length;


  const submittedHabits =
    plannedHabits.filter(
      (occurrence) =>
        occurrence.status === "submitted",
    ).length;


  // ----------------------------------------------------
  // COMPLETION
  // ----------------------------------------------------

  const totalPlanned =
    plannedTasks.length +
    plannedHabits.length;


  const completedTotal =
    validatedTasks +
    validatedHabits;


  const completionRate =
    totalPlanned > 0
      ? completedTotal /
        totalPlanned
      : undefined;


  // ----------------------------------------------------
  // ACTIVITY OCCURRING DURING PERIOD
  // ----------------------------------------------------

  const taskSubmissions =
    userAssignments.filter(
      (assignment) =>
        assignment.submittedAt !== undefined &&
        dateSet.has(
          getDateOnly(
            assignment.submittedAt,
          ),
        ),
    ).length;


  const taskValidations =
    userAssignments.filter(
      (assignment) =>
        assignment.validatedAt !== undefined &&
        dateSet.has(
          getDateOnly(
            assignment.validatedAt,
          ),
        ),
    ).length;


  const userHabitOccurrences =
    habitOccurrences.filter(
      (occurrence) =>
        occurrence.spaceId === spaceId &&
        occurrence.executorUserId === userId,
    );


  const habitSubmissions =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.submittedAt !== undefined &&
        dateSet.has(
          getDateOnly(
            occurrence.submittedAt,
          ),
        ),
    ).length;


  const habitValidations =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.validatedAt !== undefined &&
        dateSet.has(
          getDateOnly(
            occurrence.validatedAt,
          ),
        ),
    ).length;


  // ----------------------------------------------------
  // POINTS
  // ----------------------------------------------------

  const pointsEarned =
    transactions
      .filter(
        (transaction) =>
          transaction.userId === userId &&
          transaction.spaceId === spaceId &&
          dateSet.has(
            getDateOnly(
              transaction.createdAt,
            ),
          ),
      )
      .reduce(
        (total, transaction) =>
          total + transaction.amount,
        0,
      );


  // ----------------------------------------------------
  // DAYS WITH PLANNED ACTIVITY
  // ----------------------------------------------------

  const daysWithPlannedActivity =
    dates.filter((date) => {
      const hasTask =
        plannedTasks.some(
          (task) =>
            task.dueAt !== undefined &&
            getDateOnly(task.dueAt) === date,
        );

      const hasHabit =
        plannedHabits.some(
          (occurrence) =>
            occurrence.occurrenceDate === date,
        );

      return hasTask || hasHabit;
    }).length;


  // ----------------------------------------------------
  // RESULT
  // ----------------------------------------------------

  return {
    startDate,
    endDate,

    userId,
    spaceId,

    days: {
      total: dates.length,

      withContext:
        periodContexts.length,

      withPlannedActivity:
        daysWithPlannedActivity,
    },

    planned: {
      tasks:
        plannedTasks.length,

      habits:
        plannedHabits.length,

      total:
        totalPlanned,
    },

    completion: {
      validatedTasks,
      validatedHabits,

      completedTotal,

      completionRate,
    },

    punctuality: {
      tasksSubmittedOnTime,
      tasksSubmittedLate,
      tasksNotSubmitted,

      onTimeRate,
    },

    habits: {
      validated:
        validatedHabits,

      missed:
        missedHabits,

      rejected:
        rejectedHabits,

      pending:
        pendingHabits,

      submitted:
        submittedHabits,
    },

    activity: {
      taskSubmissions,
      taskValidations,

      habitSubmissions,
      habitValidations,
    },

    results: {
      pointsEarned,
    },

    context: {
      daysWithMood:
        moodValues.length,

      averageMood:
        average(
          moodValues,
        ),

      daysWithEnergy:
        energyValues.length,

      averageEnergy:
        average(
          energyValues,
        ),

      daysWithSymptoms,

      daysWithPeriod,
    },
  };
}


// ======================================================
// ANALYTICS HELPERS
// ======================================================

function average(
  values: number[],
): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length
  );
}


/**
 * Genera un rango inclusivo:
 *
 * 2026-09-28
 * 2026-09-29
 * 2026-09-30
 *
 * Se trabaja en UTC para evitar problemas
 * derivados de DST/zona horaria.
 */
function buildDateRange(
  startDate: string,
  endDate: string,
): string[] {
  const start =
    parseDateOnly(startDate);

  const end =
    parseDateOnly(endDate);

  const dates: string[] = [];

  const current =
    new Date(start.getTime());


  while (
    current.getTime() <=
    end.getTime()
  ) {
    dates.push(
      formatDateOnly(current),
    );

    current.setUTCDate(
      current.getUTCDate() + 1,
    );
  }

  return dates;
}


function parseDateOnly(
  value: string,
): Date {
  const [year, month, day] =
    value.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );
}


function formatDateOnly(
  value: Date,
): string {
  const year =
    value.getUTCFullYear();

  const month =
    String(
      value.getUTCMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      value.getUTCDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}