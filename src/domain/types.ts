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
  | "pending_invitee_acceptance"
  | "accepted"
  | "rejected";


/**
 * Cualquier miembro puede iniciar una invitación.
 *
 * Pero solamente originalCreatorId puede autorizar
 * finalmente el ingreso.
 */
export interface Invitation {
  id: string;

  spaceId: string;

  invitedByUserId: string;

  inviteeIdentifier: string;

  proposedRole: DynamicRole;

  status: InvitationStatus;

  createdAt: string;

  approvedByUserId?: string;
  approvedAt?: string;

  acceptedByUserId?: string;
  acceptedAt?: string;

  rejectedAt?: string;
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
// HABIT ASSIGNMENTS
// ======================================================

/**
 * Relaciona un hábito con un Ejecutor concreto.
 *
 * Al igual que con TaskAssignment, cada Ejecutor
 * mantiene su propio progreso.
 */
export interface HabitAssignment {
  id: ID;

  habitId: ID;
  spaceId: ID;

  executorUserId: ID;

  active: boolean;

  assignedAt: Timestamp;

  endedAt?: Timestamp;
}


// ======================================================
// HABIT OCCURRENCES
// ======================================================

export type HabitOccurrenceStatus =
  | "pending"
  | "submitted"
  | "validated"
  | "rejected"
  | "missed";


/**
 * Representa UNA ejecución concreta de un hábito.
 *
 * Ejemplo:
 *
 * "Beber 2L" asignado a Alex
 *
 * 2026-09-29 -> validated
 * 2026-09-30 -> submitted
 * 2026-10-01 -> pending
 *
 * Cada fecha conserva su propio estado,
 * validación y eventual puntuación.
 */
export interface HabitOccurrence {
  id: ID;

  habitId: ID;
  habitAssignmentId: ID;

  spaceId: ID;

  executorUserId: ID;

  /**
   * Día al que pertenece esta ocurrencia.
   *
   * Formato recomendado:
   * YYYY-MM-DD
   */
  occurrenceDate: string;

  status: HabitOccurrenceStatus;

  createdAt: Timestamp;

  submittedAt?: Timestamp;

  validatedAt?: Timestamp;
  validatedByUserId?: ID;

  rejectedAt?: Timestamp;
  rejectedByUserId?: ID;

  rejectionReason?: string;
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
// ======================================================
// DAILY PERSONAL CONTEXT
// ======================================================

/**
 * Contexto personal registrado para un día concreto.
 *
 * Es información PERSONAL del usuario.
 * No pertenece automáticamente a una DynamicSpace
 * y no se comparte con otros miembros por defecto.
 */
export interface DailyContext {
  id: ID;

  userId: ID;
  personalSpaceId: ID;

  /**
   * Día representado por este registro.
   * Formato: YYYY-MM-DD
   */
  date: string;

  /**
   * Estado emocional general.
   *
   * Escala:
   * 1 = muy bajo
   * 2 = bajo
   * 3 = neutral
   * 4 = bueno
   * 5 = muy bueno
   */
  mood?: MoodValue;

  /**
   * Nivel de energía percibido.
   *
   * Escala 1–5.
   */
  energy?: EnergyValue;

  /**
   * Síntomas o sensaciones registrados durante el día.
   *
   * Se permiten varios.
   */
  symptoms?: DailySymptom[];

  /**
   * Información opcional relacionada con
   * menstruación/ciclo.
   *
   * No todos los usuarios necesitan utilizarla.
   */
  cycle?: CycleContext;

  /**
   * Nota privada breve asociada al contexto diario.
   *
   * Esto NO sustituye al Diario.
   */
  note?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}


// ======================================================
// MOOD
// ======================================================

export type MoodValue =
  | 1
  | 2
  | 3
  | 4
  | 5;


// ======================================================
// ENERGY
// ======================================================

export type EnergyValue =
  | 1
  | 2
  | 3
  | 4
  | 5;


// ======================================================
// DAILY SYMPTOMS
// ======================================================

export type DailySymptom =
  | "cramps"
  | "headache"
  | "bloating"
  | "fatigue"
  | "stress"
  | "anxiety"
  | "irritability"
  | "sadness"
  | "low_motivation"
  | "sleep_issues"
  | "body_pain"
  | "other";


// ======================================================
// CYCLE CONTEXT
// ======================================================

export type MenstrualFlow =
  | "none"
  | "spotting"
  | "light"
  | "medium"
  | "heavy";


export interface CycleContext {
  /**
   * Indica si existe sangrado menstrual
   * registrado ese día.
   */
  period: boolean;

  /**
   * Intensidad registrada.
   */
  flow?: MenstrualFlow;

  /**
   * Día estimado/registrado dentro del ciclo,
   * cuando esté disponible.
   */
  cycleDay?: number;
}