// src/domain/points.ts

import type {
   Habit,
  HabitOccurrence,
    PointTransaction,
  Task,
  TaskAssignment,
} from "./types";

import {
  canValidateTaskAssignment,
} from "./rules";

import type {
  Membership,
} from "./types";


// ======================================================
// POINT BALANCE
// ======================================================

/**
 * El saldo NO se guarda como fuente principal de verdad.
 *
 * Se calcula siempre a partir del ledger.
 */
export function calculatePointBalance(
  userId: string,
  spaceId: string,
  transactions: PointTransaction[],
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.userId === userId &&
        transaction.spaceId === spaceId,
    )
    .reduce(
      (total, transaction) =>
        total + transaction.amount,
      0,
    );
}


// ======================================================
// DUPLICATE PROTECTION
// ======================================================

/**
 * Comprueba si una asignación ya generó
 * una transacción de puntos por validación.
 *
 * Esto evita acreditar dos veces la misma tarea.
 */
export function hasTaskValidationTransaction(
  assignmentId: string,
  transactions: PointTransaction[],
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.reason === "task_validation" &&
      transaction.sourceId === assignmentId,
  );
}


// ======================================================
// TASK VALIDATION
// ======================================================

export interface ValidateTaskResult {
  assignment: TaskAssignment;
  transaction: PointTransaction;
}


/**
 * Valida una asignación y genera la transacción
 * correspondiente.
 *
 * IMPORTANTE:
 *
 * submitted ≠ puntos
 *
 * validated = puntos
 */
export function validateTaskAndCreateTransaction(
  creatorUserId: string,
  task: Task,
  assignment: TaskAssignment,
  memberships: Membership[],
  transactions: PointTransaction[],
  transactionId: string,
  timestamp: string,
): ValidateTaskResult {
  // ----------------------------------------------------
  // 1. Comprobar que Task y Assignment corresponden
  // ----------------------------------------------------

  if (assignment.taskId !== task.id) {
    throw new Error(
      "La asignación no pertenece a esta tarea.",
    );
  }

  if (assignment.spaceId !== task.spaceId) {
    throw new Error(
      "La tarea y la asignación pertenecen a espacios diferentes.",
    );
  }


  // ----------------------------------------------------
  // 2. Comprobar autorización
  // ----------------------------------------------------

  if (
    !canValidateTaskAssignment(
      creatorUserId,
      assignment,
      memberships,
    )
  ) {
    throw new Error(
      "El usuario no puede validar esta asignación.",
    );
  }


  // ----------------------------------------------------
  // 3. Protección contra doble acreditación
  // ----------------------------------------------------

  if (
    hasTaskValidationTransaction(
      assignment.id,
      transactions,
    )
  ) {
    throw new Error(
      "Esta asignación ya generó sus puntos.",
    );
  }


  // ----------------------------------------------------
  // 4. Validar asignación
  // ----------------------------------------------------

  const validatedAssignment: TaskAssignment = {
    ...assignment,

    status: "validated",

    validatedAt: timestamp,
    validatedByUserId: creatorUserId,
  };


  // ----------------------------------------------------
  // 5. Crear transacción
  // ----------------------------------------------------

  const transaction: PointTransaction = {
    id: transactionId,

    spaceId: assignment.spaceId,

    userId: assignment.executorUserId,

    amount: task.points,

    reason: "task_validation",

    /**
     * Esta referencia hace que la transacción
     * sea trazable hasta la asignación individual.
     */
    sourceId: assignment.id,

    createdByUserId: creatorUserId,

    createdAt: timestamp,
  };


  return {
    assignment: validatedAssignment,
    transaction,
  };
}
// ======================================================
// HABIT VALIDATION — DUPLICATE PROTECTION
// ======================================================

/**
 * Comprueba si una ocurrencia de hábito ya generó
 * su transacción de puntos.
 *
 * Cada ocurrencia individual solo puede acreditar
 * puntos UNA vez.
 */
export function hasHabitValidationTransaction(
  occurrenceId: string,
  transactions: PointTransaction[],
): boolean {
  return transactions.some(
    (transaction) =>
      transaction.reason === "habit_validation" &&
      transaction.sourceId === occurrenceId,
  );
}


// ======================================================
// HABIT VALIDATION
// ======================================================

export interface ValidateHabitResult {
  occurrence: HabitOccurrence;
  transaction: PointTransaction;
}


/**
 * Valida UNA ocurrencia concreta del hábito
 * y genera la transacción correspondiente.
 *
 * submitted ≠ puntos
 *
 * validated = puntos
 */
export function validateHabitAndCreateTransaction(
  creatorUserId: string,
  habit: Habit,
  occurrence: HabitOccurrence,
  memberships: Membership[],
  transactions: PointTransaction[],
  transactionId: string,
  timestamp: string,
): ValidateHabitResult {
  // ----------------------------------------------------
  // 1. Habit y Occurrence deben corresponder
  // ----------------------------------------------------

  if (occurrence.habitId !== habit.id) {
    throw new Error(
      "La ocurrencia no pertenece a este hábito.",
    );
  }

  if (occurrence.spaceId !== habit.spaceId) {
    throw new Error(
      "El hábito y la ocurrencia pertenecen a espacios diferentes.",
    );
  }


  // ----------------------------------------------------
  // 2. Solo un Creator activo puede validar
  // ----------------------------------------------------

  const creatorMembership =
    memberships.find(
      (membership) =>
        membership.userId === creatorUserId &&
        membership.spaceId === occurrence.spaceId &&
        membership.status === "active" &&
        membership.role === "creator",
    );

  if (!creatorMembership) {
    throw new Error(
      "Solo un Creador activo puede validar este cumplimiento.",
    );
  }


  // ----------------------------------------------------
  // 3. Solo puede validarse algo enviado
  // ----------------------------------------------------

  if (occurrence.status !== "submitted") {
    throw new Error(
      "Solo puede validarse una ocurrencia enviada.",
    );
  }


  // ----------------------------------------------------
  // 4. Impedir doble acreditación
  // ----------------------------------------------------

  if (
    hasHabitValidationTransaction(
      occurrence.id,
      transactions,
    )
  ) {
    throw new Error(
      "Esta ocurrencia ya generó sus puntos.",
    );
  }


  // ----------------------------------------------------
  // 5. Validar ocurrencia
  // ----------------------------------------------------

  const validatedOccurrence: HabitOccurrence = {
    ...occurrence,

    status: "validated",

    validatedAt: timestamp,
    validatedByUserId: creatorUserId,
  };


  // ----------------------------------------------------
  // 6. Crear transacción individual
  // ----------------------------------------------------

  const transaction: PointTransaction = {
    id: transactionId,

    spaceId: occurrence.spaceId,

    userId: occurrence.executorUserId,

    amount: habit.points,

    reason: "habit_validation",

    /**
     * El sourceId es la ocurrencia, NO el hábito.
     *
     * Por eso el mismo hábito puede generar puntos
     * nuevamente mañana sin duplicar los de hoy.
     */
    sourceId: occurrence.id,

    createdByUserId: creatorUserId,

    createdAt: timestamp,
  };


  return {
    occurrence: validatedOccurrence,
    transaction,
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