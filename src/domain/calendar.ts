// src/domain/calendar.ts

import type {
  DailyContext,
  HabitOccurrence,
  PointTransaction,
  Task,
  TaskAssignment,
} from "./types";


// ======================================================
// CALENDAR DAY
// ======================================================

/**
 * CalendarDay NO es una entidad persistente.
 *
 * Es una proyección construida a partir de los
 * diferentes dominios de DYNAMIC.
 *
 * Por tanto, NO debe guardarse como una segunda
 * fuente de verdad.
 */
export interface CalendarDay {
  date: string;

  personalContext?: DailyContext;

  planned: {
    tasks: Task[];
    habitOccurrences: HabitOccurrence[];
  };

  activity: {
    submittedTasks: TaskAssignment[];
    validatedTasks: TaskAssignment[];

    submittedHabits: HabitOccurrence[];
    validatedHabits: HabitOccurrence[];
    missedHabits: HabitOccurrence[];
  };

  results: {
    pointsEarned: number;

    validatedTaskCount: number;
    validatedHabitCount: number;
  };
}


// ======================================================
// BUILD CALENDAR DAY
// ======================================================

export function buildCalendarDay(
  date: string,
  userId: string,
  spaceId: string,
  dailyContexts: DailyContext[],
  tasks: Task[],
  taskAssignments: TaskAssignment[],
  habitOccurrences: HabitOccurrence[],
  transactions: PointTransaction[],
): CalendarDay {

  // ----------------------------------------------------
  // PERSONAL CONTEXT
  // ----------------------------------------------------

  const personalContext =
    dailyContexts.find(
      (context) =>
        context.userId === userId &&
        context.date === date,
    );


  // ----------------------------------------------------
  // PLANNED TASKS
  // ----------------------------------------------------

  /**
   * Una tarea aparece como planificada cuando:
   *
   * 1. pertenece a la dinámica consultada,
   * 2. tiene dueAt,
   * 3. existe una asignación para este usuario,
   * 4. dueAt corresponde al día consultado.
   */
  const plannedTasks =
    tasks.filter((task) => {
      if (
        task.spaceId !== spaceId ||
        !task.dueAt
      ) {
        return false;
      }

      const assignedToUser =
        taskAssignments.some(
          (assignment) =>
            assignment.taskId === task.id &&
            assignment.spaceId === spaceId &&
            assignment.executorUserId === userId,
        );

      return (
        assignedToUser &&
        getDateOnly(task.dueAt) === date
      );
    });


  // ----------------------------------------------------
  // TASK ACTIVITY
  // ----------------------------------------------------

  const userAssignments =
    taskAssignments.filter(
      (assignment) =>
        assignment.spaceId === spaceId &&
        assignment.executorUserId === userId,
    );


  const submittedTasks =
    userAssignments.filter(
      (assignment) =>
        assignment.submittedAt !== undefined &&
        getDateOnly(
          assignment.submittedAt,
        ) === date,
    );


  const validatedTasks =
    userAssignments.filter(
      (assignment) =>
        assignment.validatedAt !== undefined &&
        getDateOnly(
          assignment.validatedAt,
        ) === date,
    );


  // ----------------------------------------------------
  // HABIT OCCURRENCES
  // ----------------------------------------------------

  const userHabitOccurrences =
    habitOccurrences.filter(
      (occurrence) =>
        occurrence.spaceId === spaceId &&
        occurrence.executorUserId === userId &&
        occurrence.occurrenceDate === date,
    );


  /**
   * Toda ocurrencia creada para esa fecha representa
   * un hábito esperado/planificado para ese día.
   */
  const plannedHabitOccurrences =
    userHabitOccurrences;


  const submittedHabits =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.submittedAt !== undefined,
    );


  const validatedHabits =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.status === "validated",
    );


  const missedHabits =
    userHabitOccurrences.filter(
      (occurrence) =>
        occurrence.status === "missed",
    );


  // ----------------------------------------------------
  // POINT RESULTS
  // ----------------------------------------------------

  /**
   * Los puntos se atribuyen al día en que fueron
   * realmente acreditados en el ledger.
   *
   * No necesariamente al día en que estaba
   * planificada la actividad.
   */
  const pointsEarned =
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


  return {
    date,

    personalContext,

    planned: {
      tasks: plannedTasks,
      habitOccurrences:
        plannedHabitOccurrences,
    },

    activity: {
      submittedTasks,
      validatedTasks,

      submittedHabits,
      validatedHabits,
      missedHabits,
    },

    results: {
      pointsEarned,

      validatedTaskCount:
        validatedTasks.length,

      validatedHabitCount:
        validatedHabits.length,
    },
  };
}


// ======================================================
// DATE HELPERS
// ======================================================

/**
 * Extrae YYYY-MM-DD de nuestros timestamps.
 *
 * Los timestamps actuales se representan como string.
 *
 * Esta función evita que Calendar tenga que conocer
 * detalles de la UI.
 */
function getDateOnly(
  timestamp: string,
): string {
  return timestamp.slice(0, 10);
}
