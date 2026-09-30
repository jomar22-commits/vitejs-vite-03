// src/domain/tasks.ts

import type {
  Membership,
  Task,
  TaskAssignment,
} from "./types";

import {
  canAssignTaskTo,
  canCreateTask,
  canSubmitTaskAssignment,
} from "./rules";


// ======================================================
// RESULT TYPES
// ======================================================

export interface CreateTaskResult {
  task: Task;
  assignments: TaskAssignment[];
}

export interface SubmitTaskResult {
  assignment: TaskAssignment;
}

export interface RejectTaskResult {
  assignment: TaskAssignment;
}


// ======================================================
// CREATE TASK + ASSIGNMENTS
// ======================================================

/**
 * Crea UNA definición de tarea y genera
 * UNA asignación independiente por cada Ejecutor.
 *
 * Ejemplo:
 *
 * Task = "Preparar cena" / 10 puntos
 *
 * Executor A -> Assignment A -> 10 pts potenciales
 * Executor B -> Assignment B -> 10 pts potenciales
 *
 * Los puntos NO se reparten entre ejecutores.
 */
export function createTaskWithAssignments(
  creatorUserId: string,
  spaceId: string,
  memberships: Membership[],
  taskId: string,
  assignmentIds: string[],
  executorUserIds: string[],
  title: string,
  description: string | undefined,
  points: number,
  timestamp: string,
  dueAt?: string,
): CreateTaskResult {
  // ----------------------------------------------------
  // 1. Solo Creator puede crear tareas compartidas
  // ----------------------------------------------------

  if (
    !canCreateTask(
      creatorUserId,
      spaceId,
      memberships,
    )
  ) {
    throw new Error(
      "Solo un Creador activo puede crear tareas en esta dinámica.",
    );
  }


  // ----------------------------------------------------
  // 2. Debe existir al menos un Ejecutor
  // ----------------------------------------------------

  if (executorUserIds.length === 0) {
    throw new Error(
      "La tarea debe asignarse al menos a un Ejecutor.",
    );
  }


  // ----------------------------------------------------
  // 3. No permitimos ejecutores duplicados
  // ----------------------------------------------------

  const uniqueExecutorIds = [
    ...new Set(executorUserIds),
  ];

  if (
    uniqueExecutorIds.length !==
    executorUserIds.length
  ) {
    throw new Error(
      "Un Ejecutor no puede recibir dos veces la misma tarea.",
    );
  }


  // ----------------------------------------------------
  // 4. Necesitamos un ID por asignación
  // ----------------------------------------------------

  if (
    assignmentIds.length !==
    executorUserIds.length
  ) {
    throw new Error(
      "Debe existir un identificador por cada asignación.",
    );
  }


  // ----------------------------------------------------
  // 5. Todos deben ser Executors activos
  //    de ESTA dinámica
  // ----------------------------------------------------

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


  // ----------------------------------------------------
  // 6. Validar puntos
  // ----------------------------------------------------

  if (
    !Number.isFinite(points) ||
    points < 0
  ) {
    throw new Error(
      "El valor de puntos de la tarea no es válido.",
    );
  }


  // ----------------------------------------------------
  // 7. Crear UNA Task
  // ----------------------------------------------------

  const task: Task = {
    id: taskId,

    spaceId,

    createdByUserId: creatorUserId,

    title,
    description,

    points,

    dueAt,

    createdAt: timestamp,
  };


  // ----------------------------------------------------
  // 8. Crear UNA Assignment por Ejecutor
  // ----------------------------------------------------

  const assignments: TaskAssignment[] =
    executorUserIds.map(
      (executorUserId, index) => ({
        id: assignmentIds[index],

        taskId,

        spaceId,

        executorUserId,

        status: "pending",

        assignedAt: timestamp,
      }),
    );


  return {
    task,
    assignments,
  };
}


// ======================================================
// SUBMIT ASSIGNMENT
// ======================================================

/**
 * El Ejecutor marca SU asignación como completada.
 *
 * IMPORTANTE:
 * Esto NO genera puntos.
 *
 * Solo cambia:
 *
 * pending -> submitted
 */
export function submitTaskAssignment(
  userId: string,
  assignment: TaskAssignment,
  timestamp: string,
): SubmitTaskResult {
  if (
    !canSubmitTaskAssignment(
      userId,
      assignment,
    )
  ) {
    throw new Error(
      "El usuario no puede completar esta asignación.",
    );
  }

  const submittedAssignment: TaskAssignment = {
    ...assignment,

    status: "submitted",

    submittedAt: timestamp,
  };

  return {
    assignment: submittedAssignment,
  };
}


// ======================================================
// REJECT SUBMITTED ASSIGNMENT
// ======================================================

/**
 * Un Creator puede rechazar una entrega.
 *
 * El rechazo tampoco genera puntos.
 */
export function rejectTaskAssignment(
  creatorUserId: string,
  assignment: TaskAssignment,
  memberships: Membership[],
  reason: string,
  timestamp: string,
): RejectTaskResult {
  const creatorMembership =
    memberships.find(
      (membership) =>
        membership.userId === creatorUserId &&
        membership.spaceId ===
          assignment.spaceId &&
        membership.status === "active" &&
        membership.role === "creator",
    );

  if (!creatorMembership) {
    throw new Error(
      "Solo un Creador activo puede rechazar una entrega.",
    );
  }

  if (assignment.status !== "submitted") {
    throw new Error(
      "Solo puede rechazarse una tarea enviada para validación.",
    );
  }

  const rejectedAssignment: TaskAssignment = {
    ...assignment,

    status: "rejected",

    rejectedAt: timestamp,
    rejectedByUserId: creatorUserId,

    rejectionReason: reason,
  };

  return {
    assignment: rejectedAssignment,
  };
}