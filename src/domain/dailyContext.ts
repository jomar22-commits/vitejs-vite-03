// src/domain/dailyContext.ts

import type {
  CycleContext,
  DailyContext,
  DailySymptom,
  EnergyValue,
  MoodValue,
} from "./types";


// ======================================================
// INPUT TYPES
// ======================================================

export interface DailyContextInput {
  mood?: MoodValue;
  energy?: EnergyValue;
  symptoms?: DailySymptom[];
  cycle?: CycleContext;
  note?: string;
}


// ======================================================
// FIND DAILY CONTEXT
// ======================================================

/**
 * Busca el registro personal correspondiente
 * a un usuario y una fecha.
 *
 * Regla:
 * userId + date = máximo UN DailyContext.
 */
export function findDailyContext(
  userId: string,
  date: string,
  contexts: DailyContext[],
): DailyContext | undefined {
  return contexts.find(
    (context) =>
      context.userId === userId &&
      context.date === date,
  );
}


// ======================================================
// DUPLICATE PROTECTION
// ======================================================

export function hasDailyContext(
  userId: string,
  date: string,
  contexts: DailyContext[],
): boolean {
  return Boolean(
    findDailyContext(
      userId,
      date,
      contexts,
    ),
  );
}


// ======================================================
// CREATE DAILY CONTEXT
// ======================================================

export function createDailyContext(
  id: string,
  userId: string,
  personalSpaceId: string,
  date: string,
  input: DailyContextInput,
  existingContexts: DailyContext[],
  timestamp: string,
): DailyContext {
  if (
    hasDailyContext(
      userId,
      date,
      existingContexts,
    )
  ) {
    throw new Error(
      "Ya existe un contexto diario para este usuario y fecha.",
    );
  }

  validateDailyContextInput(input);

  return {
    id,

    userId,
    personalSpaceId,

    date,

    ...normalizeDailyContextInput(input),

    createdAt: timestamp,
    updatedAt: timestamp,
  };
}


// ======================================================
// UPDATE DAILY CONTEXT
// ======================================================

/**
 * Actualiza el registro existente.
 *
 * No crea un segundo registro para el mismo día.
 */
export function updateDailyContext(
  context: DailyContext,
  userId: string,
  input: DailyContextInput,
  timestamp: string,
): DailyContext {
  if (context.userId !== userId) {
    throw new Error(
      "El usuario no puede modificar este contexto diario.",
    );
  }

  validateDailyContextInput(input);

  return {
    ...context,

    ...normalizeDailyContextInput(input),

    updatedAt: timestamp,
  };
}


// ======================================================
// UPSERT DAILY CONTEXT
// ======================================================

/**
 * Operación conveniente para UI/Firebase:
 *
 * - Si no existe el día -> create
 * - Si ya existe       -> update
 *
 * La capa persistente deberá aplicar esta operación
 * de forma atómica cuando conectemos Firebase.
 */
export function upsertDailyContext(
  id: string,
  userId: string,
  personalSpaceId: string,
  date: string,
  input: DailyContextInput,
  contexts: DailyContext[],
  timestamp: string,
): DailyContext {
  const existing = findDailyContext(
    userId,
    date,
    contexts,
  );

  if (existing) {
    if (
      existing.personalSpaceId !==
      personalSpaceId
    ) {
      throw new Error(
        "El contexto diario pertenece a otro espacio personal.",
      );
    }

    return updateDailyContext(
      existing,
      userId,
      input,
      timestamp,
    );
  }

  return createDailyContext(
    id,
    userId,
    personalSpaceId,
    date,
    input,
    contexts,
    timestamp,
  );
}


// ======================================================
// INPUT VALIDATION
// ======================================================

function validateDailyContextInput(
  input: DailyContextInput,
): void {
  if (
    input.note !== undefined &&
    input.note.length > 1000
  ) {
    throw new Error(
      "La nota del contexto diario no puede superar 1000 caracteres.",
    );
  }

  if (
    input.cycle?.cycleDay !== undefined &&
    (
      !Number.isInteger(
        input.cycle.cycleDay,
      ) ||
      input.cycle.cycleDay < 1
    )
  ) {
    throw new Error(
      "El día del ciclo debe ser un número entero positivo.",
    );
  }

  if (
    input.cycle?.period === false &&
    input.cycle.flow !== undefined &&
    input.cycle.flow !== "none"
  ) {
    throw new Error(
      "No puede registrarse flujo menstrual si period es false.",
    );
  }
}


// ======================================================
// NORMALIZATION
// ======================================================

function normalizeDailyContextInput(
  input: DailyContextInput,
): DailyContextInput {
  const normalizedSymptoms =
    input.symptoms
      ? [...new Set(input.symptoms)]
      : undefined;

  const normalizedNote =
    input.note?.trim() || undefined;

  return {
    mood: input.mood,
    energy: input.energy,

    symptoms:
      normalizedSymptoms &&
      normalizedSymptoms.length > 0
        ? normalizedSymptoms
        : undefined,

    cycle: input.cycle,

    note: normalizedNote,
  };
}