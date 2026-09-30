// src/domain/types.ts

/**
 * DYNAMIC — Domain Model v1
 *
 * Principio base:
 * El espacio personal y la dinámica compartida son contextos
 * independientes. Sus datos, puntos e históricos no se mezclan.
 */

// ======================================================
// BASIC TYPES
// ======================================================

export type ID = string;

export type Timestamp = string;


// ======================================================
// USER
// ======================================================

export interface User {
  id: ID;

  email: string;
  username: string;
  displayName: string;

  /**
   * Una cuenta puede tener como máximo una dinámica
   * compartida activa.
   *
   * null = actualmente no pertenece a ninguna.
   */
  activeDynamicSpaceId: ID | null;

  createdAt: Timestamp;
}


// ======================================================
// PERSONAL SPACE
// ======================================================

/**
 * Todo usuario posee siempre un espacio personal.
 *
 * En este contexto puede actuar simultáneamente como
 * creador y ejecutor.
 *
 * Este espacio NO es una DynamicSpace compartida.
 */
export interface PersonalSpace {
  id: ID;
  userId: ID;

  createdAt: Timestamp;
}


// ======================================================
// SHARED ROLES
// ======================================================

/**
 * Los roles solo tienen significado dentro de
 * una dinámica compartida.
 */
export type DynamicRole = "creator" | "executor";


// ======================================================
// DYNAMIC SPACE
// ======================================================

export type DynamicSpaceStatus =
  | "forming"
  | "active"
  | "archived";


/**
 * Una DynamicSpace representa una única dinámica
 * compartida.
 *
 * Para considerarse funcional debe existir al menos:
 *
 * 1 creator
 * +
 * 1 executor
 */
export interface DynamicSpace {
  id: ID;

  name: string;

  /**
   * Usuario que creó originalmente la dinámica.
   *
   * Tiene autoridad administrativa especial,
   * independientemente de que existan otros creators.
   */
  originalCreatorId: ID;

  status: DynamicSpaceStatus;

  createdAt: Timestamp;
  archivedAt?: Timestamp;
}


// ======================================================
// MEMBERSHIP
// ======================================================

export type MembershipStatus =
  | "active"
  | "left"
  | "removed";


/**
 * Relaciona un usuario con una DynamicSpace.
 *
 * Un usuario solo puede tener UNA Membership activa
 * simultáneamente.
 */
export interface Membership {
  id: ID;

  userId: ID;
  spaceId: ID;

  role: DynamicRole;

  status: MembershipStatus;

  joinedAt: Timestamp;

  leftAt?: Timestamp;
}


// ======================================================
// INVITATIONS
// ======================================================

export type InvitationStatus =
  | "pending_owner_approval"
  | "pending_invitee"
  | "accepted"
  | "rejected_by_owner"
  | "declined_by_invitee"
  | "cancelled"
  | "expired";


/**
 * Cualquier miembro puede iniciar una invitación.
 *
 * Pero solamente originalCreatorId puede autorizar
 * finalmente el ingreso.
 */
export interface Invitation {
  id: ID;

  spaceId: ID;

  /**
   * Miembro que inició la invitación.
   */
  invitedByUserId: ID;

  /**
   * Usuario invitado si ya tiene cuenta.
   *
   * Puede ser null cuando la invitación se realizó
   * por email a alguien que todavía no está registrado.
   */
  invitedUserId?: ID;

  /**
   * Identificadores utilizados para localizar/invitar.
   */
  invitedEmail?: string;
  invitedUsername?: string;

  /**
   * Rol propuesto dentro de la dinámica.
   */
  proposedRole: DynamicRole;

  status: InvitationStatus;

  createdAt: Timestamp;

  /**
   * Se completa cuando el Creador Original
   * autoriza explícitamente la invitación.
   */
  approvedByUserId?: ID;
  approvedAt?: Timestamp;

  /**
   * Se completa cuando el invitado acepta.
   */
  acceptedAt?: Timestamp;

  expiresAt?: Timestamp;
}


// ======================================================
// TASKS
// ======================================================

/**
 * Task contiene la definición compartida creada
 * por un Creator.
 *
 * NO contiene el progreso individual.
 */
export interface Task {
  id: ID;
  spaceId: ID;

  createdByUserId: ID;

  title: string;
  description?: string;

  /**
   * Valor potencial POR EJECUTOR.
   *
   * Una tarea de 10 puntos asignada a dos ejecutores
   * puede generar 10 puntos para cada uno.
   */
  points: number;

  dueAt?: Timestamp;

  createdAt: Timestamp;
}


// ======================================================
// TASK ASSIGNMENTS
// ======================================================

export type TaskAssignmentStatus =
  | "pending"
  | "submitted"
  | "validated"
  | "rejected";


/**
 * Cada Ejecutor recibe su propia asignación.
 *
 * La definición de Task es compartida,
 * pero ejecución, validación y puntos son individuales.
 */
export interface TaskAssignment {
  id: ID;

  taskId: ID;
  spaceId: ID;

  executorUserId: ID;

  status: TaskAssignmentStatus;

  assignedAt: Timestamp;

  submittedAt?: Timestamp;

  validatedAt?: Timestamp;
  validatedByUserId?: ID;

  rejectedAt?: Timestamp;
  rejectedByUserId?: ID;

  rejectionReason?: string;
}


// ======================================================
// HABITS
// ======================================================

export interface Habit {
  id: ID;
  spaceId: ID;

  createdByUserId: ID;

  title: string;
  description?: string;

  /**
   * Valor potencial de cada cumplimiento validado.
   */
  points: number;

  active: boolean;

  createdAt: Timestamp;
}


// ======================================================
// POINT LEDGER
// ======================================================

export type PointTransactionReason =
  | "task_validation"
  | "habit_validation"
  | "reward"
  | "bonus"
  | "adjustment";


/**
 * Los puntos se calculan a partir de transacciones.
 *
 * Nunca debemos tratar un número de saldo almacenado
 * como la fuente principal de verdad.
 */
export interface PointTransaction {
  id: ID;

  spaceId: ID;

  /**
   * Persona cuyo balance cambia.
   */
  userId: ID;

  amount: number;

  reason: PointTransactionReason;

  /**
   * Referencia al origen de la transacción.
   *
   * Será fundamental para impedir que una misma
   * validación genere puntos dos veces.
   */
  sourceId?: ID;

  createdByUserId: ID;

  createdAt: Timestamp;
}