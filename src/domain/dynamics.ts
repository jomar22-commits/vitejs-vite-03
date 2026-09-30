// src/domain/dynamics.ts

import type {
  DynamicSpace,
  Invitation,
  Membership,
  User,
  DynamicRole,
} from "./types";

import {
  canApproveInvitation,
  canCreateDynamic,
  canInviteMember,
  canJoinDynamic,
  isOriginalCreator,
} from "./rules";


// ======================================================
// RESULT TYPES
// ======================================================

export interface CreateDynamicResult {
  space: DynamicSpace;
  membership: Membership;
}

export interface CreateInvitationResult {
  invitation: Invitation;
}

export interface ApproveInvitationResult {
  invitation: Invitation;
}

export interface AcceptInvitationResult {
  invitation: Invitation;
  membership: Membership;
}

export interface LeaveDynamicResult {
  membership: Membership;
}


// ======================================================
// CREATE DYNAMIC
// ======================================================

/**
 * Crea una nueva dinámica compartida.
 *
 * El usuario que la crea se convierte automáticamente
 * en su Creador Original.
 */
export function createDynamic(
  user: User,
  memberships: Membership[],
  spaceId: string,
  membershipId: string,
  name: string,
  timestamp: string,
): CreateDynamicResult {
  if (!canCreateDynamic(user, memberships)) {
    throw new Error(
      "El usuario ya pertenece a una dinámica activa.",
    );
  }

  const space: DynamicSpace = {
    id: spaceId,
    name,
    originalCreatorId: user.id,
    status: "active",
    createdAt: timestamp,
  };

  const membership: Membership = {
    id: membershipId,
    userId: user.id,
    spaceId,
    role: "creator",
    status: "active",
    joinedAt: timestamp,
  };

  return {
    space,
    membership,
  };
}


// ======================================================
// CREATE INVITATION
// ======================================================

/**
 * Cualquier miembro activo puede iniciar una invitación.
 *
 * IMPORTANTE:
 * crear una invitación NO introduce todavía al usuario
 * dentro de la dinámica.
 */
export function createInvitation(
  inviterUserId: string,
  space: DynamicSpace,
  memberships: Membership[],
  invitationId: string,
  inviteeIdentifier: string,
  proposedRole: DynamicRole,
  timestamp: string,
): CreateInvitationResult {
  if (
    !canInviteMember(
      inviterUserId,
      space.id,
      memberships,
    )
  ) {
    throw new Error(
      "El usuario no puede invitar miembros a esta dinámica.",
    );
  }

  if (space.status !== "active") {
    throw new Error(
      "No se pueden crear invitaciones para una dinámica inactiva.",
    );
  }

  const invitation: Invitation = {
    id: invitationId,

    spaceId: space.id,

    invitedByUserId: inviterUserId,

    /**
     * Puede representar inicialmente:
     * - email
     * - username
     *
     * La resolución hacia un userId real ocurrirá
     * cuando conectemos autenticación/persistencia.
     */
    inviteeIdentifier,

    proposedRole,

    status: "pending_owner_approval",

    createdAt: timestamp,
  };

  return {
    invitation,
  };
}


// ======================================================
// OWNER APPROVAL
// ======================================================

/**
 * El Creador Original tiene la última palabra.
 *
 * Otros miembros pueden iniciar invitaciones,
 * pero no aprobar el ingreso definitivo.
 */
export function approveInvitation(
  approverUserId: string,
  space: DynamicSpace,
  invitation: Invitation,
  timestamp: string,
): ApproveInvitationResult {
  if (
    !canApproveInvitation(
      approverUserId,
      space,
      invitation,
    )
  ) {
    throw new Error(
      "Solo el Creador Original puede aprobar esta invitación.",
    );
  }

  const approvedInvitation: Invitation = {
    ...invitation,

    status: "pending_invitee_acceptance",

    approvedByUserId: approverUserId,

    approvedAt: timestamp,
  };

  return {
    invitation: approvedInvitation,
  };
}


// ======================================================
// ACCEPT INVITATION
// ======================================================

/**
 * El invitado acepta entrar a la dinámica.
 *
 * En este momento comprobamos la exclusividad:
 * si ya pertenece a otra dinámica activa,
 * NO puede ingresar.
 */
export function acceptInvitation(
  user: User,
  invitation: Invitation,
  memberships: Membership[],
  membershipId: string,
  timestamp: string,
): AcceptInvitationResult {
  if (
    invitation.status !==
    "pending_invitee_acceptance"
  ) {
    throw new Error(
      "La invitación todavía no puede ser aceptada.",
    );
  }

  if (!canJoinDynamic(user, memberships)) {
    throw new Error(
      "El usuario debe abandonar su dinámica actual antes de ingresar a otra.",
    );
  }

  /**
   * Cuando tengamos Auth resolveremos inviteeIdentifier
   * contra email/username/userId antes de llegar aquí.
   *
   * Por ahora esta función asume que esa resolución
   * ya fue realizada por la capa superior.
   */

  const membership: Membership = {
    id: membershipId,

    userId: user.id,

    spaceId: invitation.spaceId,

    role: invitation.proposedRole,

    status: "active",

    joinedAt: timestamp,
  };

  const acceptedInvitation: Invitation = {
    ...invitation,

    status: "accepted",

    acceptedByUserId: user.id,

    acceptedAt: timestamp,
  };

  return {
    invitation: acceptedInvitation,
    membership,
  };
}


// ======================================================
// LEAVE DYNAMIC
// ======================================================

/**
 * Permite abandonar una dinámica.
 *
 * No eliminamos la Membership.
 * La conservamos como histórico.
 */
export function leaveDynamic(
  userId: string,
  space: DynamicSpace,
  membership: Membership,
  timestamp: string,
): LeaveDynamicResult {
  if (
    membership.userId !== userId ||
    membership.spaceId !== space.id ||
    membership.status !== "active"
  ) {
    throw new Error(
      "No existe una membresía activa que pueda abandonarse.",
    );
  }

  /**
   * El Creador Original requiere un tratamiento especial.
   *
   * No permitimos simplemente que desaparezca porque
   * dejaríamos la dinámica sin autoridad final.
   *
   * Más adelante podremos implementar:
   * - cerrar dinámica
   * - transferir propiedad
   */
  if (isOriginalCreator(userId, space)) {
    throw new Error(
      "El Creador Original no puede abandonar la dinámica sin cerrarla o transferirla.",
    );
  }

  const inactiveMembership: Membership = {
    ...membership,

    status: "left",

    leftAt: timestamp,
  };

  return {
    membership: inactiveMembership,
  };
}


// ======================================================
// REJECT INVITATION
// ======================================================

export function rejectInvitation(
  invitation: Invitation,
  timestamp: string,
): Invitation {
  if (
    invitation.status === "accepted" ||
    invitation.status === "rejected"
  ) {
    throw new Error(
      "Esta invitación ya fue resuelta.",
    );
  }

  return {
    ...invitation,

    status: "rejected",

    rejectedAt: timestamp,
  };
}