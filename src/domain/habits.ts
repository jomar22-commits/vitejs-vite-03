// src/domain/habits.ts

import type {
  Habit,
  HabitAssignment,
  HabitOccurrence,
  Membership,
} from "./types";

import {
  canAssignTaskTo,
  canCreateTask,
  isCreator,
} from "./rules";


// ======================================================
// RESULT TYPES
// ======================================================

export interface CreateHabitResult {
  habit: Habit;
  assignments: HabitAssignment[];
}

export interface CreateHabitOccurrenceResult {
  occurrence: HabitOccurrence;
}

export interface SubmitHabitOccurrenceResult {
  occurrence: HabitOccurrence;
}

export interface RejectHabitOccurrenceResult {
  occurrence: HabitOccurrence;
}


// ======================================================
// CREATE HABIT + ASSIGNMENTS
// ======================================================

/**
 * Crea UNA definición de hábito y UNA asignación
 * independiente por cada Ejecutor.
 *
 * El valor de puntos pertenece a cada cumplimiento
 * individual validado.
 */
export function createHabitWithAssignments(
  creatorUserId: string,
  spaceId: string,
  memberships: Membership[],
  habitId: string,
  assignmentIds: string[],
  executorUserIds: string[],
  title: string,
  description: string | undefined,
  points: number,
  timestamp: string,
): CreateHabitResult {
  if (
    !canCreateTask(
      creatorUserId,
      spaceId,
      memberships,
    )
  ) {
    throw new Error(
      "Solo un Creador activo puede crear hábitos en esta dinámica.",
    );
  }

  if (executorUserIds.length === 0) {
    throw new Error(
      "El hábito debe asignarse al menos a un Ejecutor.",
    );
  }

  const uniqueExecutorIds = [
    ...new Set(executorUserIds),
  ];

  if (
    uniqueExecutorIds.length !==
    executorUserIds.length
  ) {
    throw new Error(
      "Un Ejecutor no puede recibir dos veces el mismo hábito.",
    );
  }

  if (
    assignmentIds.length !==
    executorUserIds.length
  ) {
    throw new Error(
      "Debe existir un identificador por cada asignación de hábito.",
    );
  }

  for (const executorUserId of executorUserIds) {
    if (
      !canAssignTaskTo(
        executorUserId,
        spaceId,
        memberships,
      )
    ) {
      throw new Error(
        "Todas las personas asignadas deben ser Ejecutores activos de esta dinámica.",
      );
    }
  }

  if (
    !Number.isFinite(points) ||
    points < 0
  ) {
    throw new Error(
      "El valor de puntos del hábito no es válido.",
    );
  }

  const habit: Habit = {
    id: habitId,

    spaceId,

    createdByUserId: creatorUserId,

    title,
    description,

    points,

    active: true,

    createdAt: timestamp,
  };

  const assignments: HabitAssignment[] =
    executorUserIds.map(
      (executorUserId, index) => ({
        id: assignmentIds[index],

        habitId,

        spaceId,

        executorUserId,

        active: true,

        assignedAt: timestamp,
      }),
    );

  return {
    habit,
    assignments,
  };
}


// ======================================================
// CREATE OCCURRENCE
// ======================================================

/**
 * Genera la ocurrencia de un día concreto.
 *
 * Esta función NO marca el hábito como realizado.
 * La ocurrencia nace en estado pending.
 */
export function createHabitOccurrence(
  habit: Habit,
  assignment: HabitAssignment,
  occurrenceId: string,
  occurrenceDate: string,
  timestamp: string,
): CreateHabitOccurrenceResult {
  if (!habit.active) {
    throw new Error(
      "No pueden generarse ocurrencias para un hábito inactivo.",
    );
  }

  if (!assignment.active) {
    throw new Error(
      "La asignación de hábito no está activa.",
    );
  }

  if (
    assignment.habitId !== habit.id ||
    assignment.spaceId !== habit.spaceId
  ) {
    throw new Error(
      "La asignación no pertenece a este hábito.",
    );
  }

  const occurrence: HabitOccurrence = {
    id: occurrenceId,

    habitId: habit.id,

    habitAssignmentId: assignment.id,

    spaceId: habit.spaceId,

    executorUserId:
      assignment.executorUserId,

    occurrenceDate,

    status: "pending",

    createdAt: timestamp,
  };

  return {
    occurrence,
  };
}


// ======================================================
// SUBMIT OCCURRENCE
// ======================================================

/**
 * El Ejecutor registra que cumplió esa ocurrencia.
 *
 * pending -> submitted
 *
 * IMPORTANTE:
 * todavía NO se acreditan puntos.
 */
export function submitHabitOccurrence(
  userId: string,
  occurrence: HabitOccurrence,
  timestamp: string,
): SubmitHabitOccurrenceResult {
  if (
    occurrence.executorUserId !== userId
  ) {
    throw new Error(
      "El usuario no puede completar esta ocurrencia.",
    );
  }

  if (occurrence.status !== "pending") {
    throw new Error(
      "Solo puede completarse una ocurrencia pendiente.",
    );
  }

  const submittedOccurrence: HabitOccurrence = {
    ...occurrence,

    status: "submitted",

    submittedAt: timestamp,
  };

  return {
    occurrence: submittedOccurrence,
  };
}


// ======================================================
// REJECT OCCURRENCE
// ======================================================

export function rejectHabitOccurrence(
  creatorUserId: string,
  occurrence: HabitOccurrence,
  memberships: Membership[],
  reason: string,
  timestamp: string,
): RejectHabitOccurrenceResult {
  if (
    !isCreator(
      creatorUserId,
      occurrence.spaceId,
      memberships,
    )
  ) {
    throw new Error(
      "Solo un Creador activo puede rechazar este cumplimiento.",
    );
  }

  if (occurrence.status !== "submitted") {
    throw new Error(
      "Solo puede rechazarse una ocurrencia enviada para validación.",
    );
  }

  const rejectedOccurrence: HabitOccurrence = {
    ...occurrence,

    status: "rejected",

    rejectedAt: timestamp,
    rejectedByUserId: creatorUserId,

    rejectionReason: reason,
  };

  return {
    occurrence: rejectedOccurrence,
  };
}


// ======================================================
// MARK MISSED
// ======================================================

/**
 * Permite cerrar una ocurrencia pendiente como no cumplida.
 *
 * pending -> missed
 *
 * No genera puntos.
 */
export function markHabitOccurrenceMissed(
  occurrence: HabitOccurrence,
): HabitOccurrence {
  if (occurrence.status !== "pending") {
    throw new Error(
      "Solo una ocurrencia pendiente puede marcarse como no cumplida.",
    );
  }

  return {
    ...occurrence,
    status: "missed",
  };
}
// ======================================================
// HABIT STREAKS
// ======================================================

export interface HabitStreakResult {
  current: number;
  longest: number;
  totalValidated: number;
}


/**
 * Calcula las rachas de UNA asignación concreta.
 *
 * Solo las ocurrencias "validated" cuentan
 * como cumplimiento.
 *
 * Una racha representa días consecutivos
 * validados.
 */
export function calculateHabitStreak(
  habitAssignmentId: string,
  occurrences: HabitOccurrence[],
): HabitStreakResult {
  const validatedDates = [
    ...new Set(
      occurrences
        .filter(
          (occurrence) =>
            occurrence.habitAssignmentId ===
              habitAssignmentId &&
            occurrence.status === "validated",
        )
        .map(
          (occurrence) =>
            occurrence.occurrenceDate,
        ),
    ),
  ].sort();


  if (validatedDates.length === 0) {
    return {
      current: 0,
      longest: 0,
      totalValidated: 0,
    };
  }


  let longest = 1;
  let running = 1;

  for (
    let index = 1;
    index < validatedDates.length;
    index += 1
  ) {
    const previousDate =
      parseDateOnly(validatedDates[index - 1]);

    const currentDate =
      parseDateOnly(validatedDates[index]);

    const differenceInDays =
      Math.round(
        (currentDate.getTime() -
          previousDate.getTime()) /
          86_400_000,
      );

    if (differenceInDays === 1) {
      running += 1;

      if (running > longest) {
        longest = running;
      }
    } else {
      running = 1;
    }
  }


  /**
   * "current" representa la racha que termina
   * en la última ocurrencia validada disponible.
   *
   * Más adelante, la UI podrá decidir si quiere
   * considerarla "activa hoy" comparándola con
   * la fecha actual/calendario.
   */
  let current = 1;

  for (
    let index = validatedDates.length - 1;
    index > 0;
    index -= 1
  ) {
    const currentDate =
      parseDateOnly(validatedDates[index]);

    const previousDate =
      parseDateOnly(validatedDates[index - 1]);

    const differenceInDays =
      Math.round(
        (currentDate.getTime() -
          previousDate.getTime()) /
          86_400_000,
      );

    if (differenceInDays !== 1) {
      break;
    }

    current += 1;
  }


  return {
    current,
    longest,
    totalValidated: validatedDates.length,
  };
}


// ======================================================
// DATE HELPERS
// ======================================================

/**
 * Convierte YYYY-MM-DD a una fecha UTC.
 *
 * Utilizamos UTC para evitar que cambios de zona
 * horaria o DST rompan el cálculo de días consecutivos.
 */
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