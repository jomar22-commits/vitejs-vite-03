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