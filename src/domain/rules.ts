// src/domain/rules.ts

import type {
  DynamicSpace,
  Invitation,
  Membership,
  TaskAssignment,
  User,
} from "./types";

// ======================================================
// MEMBERSHIP HELPERS
// ======================================================

export function getActiveMembership(
  userId: string,
  memberships: Membership[],
): Membership | undefined {
  return memberships.find(
    (membership) =>
      membership.userId === userId &&
      membership.status === "active",
  );
}

/**
 * REGLA 09
 *
 * Un usuario puede pertenecer como máximo
 * a una dinámica compartida activa.
 */
export function canJoinDynamic(
  user: User,
  memberships: Membership[],
): boolean {
  return !getActiveMembership(user.id, memberships);
}

/**
 * También impedimos crear una nueva dinámica
 * mientras el usuario ya pertenezca a otra.
 */
export function canCreateDynamic(
  user: User,
  memberships: Membership[],
): boolean {
  return canJoinDynamic(user, memberships);
}

// ======================================================
// ROLE HELPERS
// ======================================================

export function isCreator(
  userId: string,
  spaceId: string,
  memberships: Membership[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.spaceId === spaceId &&
      membership.status === "active" &&
      membership.role === "creator",
  );
}

export function isExecutor(
  userId: string,
  spaceId: string,
  memberships: Membership[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.spaceId === spaceId &&
      membership.status === "active" &&
      membership.role === "executor",
  );
}

// ======================================================
// ORIGINAL CREATOR
// ======================================================

export function isOriginalCreator(
  userId: string,
  space: DynamicSpace,
): boolean {
  return space.originalCreatorId === userId;
}

// ======================================================
// INVITATIONS
// ======================================================

/**
 * REGLA 05
 *
 * Cualquier miembro ACTIVO de la dinámica
 * puede iniciar una invitación.
 */
export function canInviteMember(
  userId: string,
  spaceId: string,
  memberships: Membership[],
): boolean {
  return memberships.some(
    (membership) =>
      membership.userId === userId &&
      membership.spaceId === spaceId &&
      membership.status === "active",
  );
}

/**
 * REGLA 06
 *
 * Solo el Creador Original puede autorizar
 * definitivamente el ingreso de otra persona.
 */
export function canApproveInvitation(
  userId: string,
  space: DynamicSpace,
  invitation: Invitation,
): boolean {
  return (
    invitation.spaceId === space.id &&
    invitation.status === "pending_owner_approval" &&
    isOriginalCreator(userId, space)
  );
}

// ======================================================
// TASK CREATION
// ======================================================

/**
 * REGLAS 02 Y 03
 *
 * Solo un Creator activo puede crear y estructurar
 * tareas dentro de una dinámica compartida.
 */
export function canCreateTask(
  userId: string,
  spaceId: string,
  memberships: Membership[],
): boolean {
  return isCreator(userId, spaceId, memberships);
}

/**
 * Una tarea compartida solo puede asignarse
 * a un Executor activo de ESA misma dinámica.
 */
export function canAssignTaskTo(
  executorUserId: string,
  spaceId: string,
  memberships: Membership[],
): boolean {
  return isExecutor(
    executorUserId,
    spaceId,
    memberships,
  );
}

// ======================================================
// TASK EXECUTION
// ======================================================

/**
 * Solamente el Ejecutor dueño de la asignación
 * puede marcarla como realizada/enviada.
 */
export function canSubmitTaskAssignment(
  userId: string,
  assignment: TaskAssignment,
): boolean {
  return (
    assignment.executorUserId === userId &&
    assignment.status === "pending"
  );
}

/**
 * REGLA 04
 *
 * Completar/enviar NO acredita puntos.
 *
 * La asignación debe encontrarse en "submitted"
 * y un Creator activo de esa dinámica debe validarla.
 */
export function canValidateTaskAssignment(
  userId: string,
  assignment: TaskAssignment,
  memberships: Membership[],
): boolean {
  return (
    assignment.status === "submitted" &&
    isCreator(
      userId,
      assignment.spaceId,
      memberships,
    )
  );
}

// ======================================================
// CHAT
// ======================================================

/**
 * El Chat pertenece a la dinámica, no al espacio personal.
 *
 * Solo está disponible cuando:
 *
 * 1. La dinámica está activa.
 * 2. Existe al menos un Creator activo.
 * 3. Existe al menos un Executor activo.
 */
export function canAccessChat(
  userId: string,
  space: DynamicSpace,
  memberships: Membership[],
): boolean {
  if (space.status !== "active") {
    return false;
  }

  const activeMembers = memberships.filter(
    (membership) =>
      membership.spaceId === space.id &&
      membership.status === "active",
  );

  const requestingUserBelongsToSpace =
    activeMembers.some(
      (membership) =>
        membership.userId === userId,
    );

  if (!requestingUserBelongsToSpace) {
    return false;
  }

  const hasCreator = activeMembers.some(
    (membership) =>
      membership.role === "creator",
  );

  const hasExecutor = activeMembers.some(
    (membership) =>
      membership.role === "executor",
  );

  return hasCreator && hasExecutor;
}

// ======================================================
// DYNAMIC STATUS
// ======================================================

/**
 * Determina si la composición de miembros permite
 * considerar funcional una dinámica.
 */
export function hasFunctionalDynamicComposition(
  spaceId: string,
  memberships: Membership[],
): boolean {
  const activeMembers = memberships.filter(
    (membership) =>
      membership.spaceId === spaceId &&
      membership.status === "active",
  );

  return (
    activeMembers.some(
      (membership) =>
        membership.role === "creator",
    ) &&
    activeMembers.some(
      (membership) =>
        membership.role === "executor",
    )
  );
}