// src/domain/points.ts

import type {
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