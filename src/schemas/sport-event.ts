import { z } from "zod";

/**
 * Status do evento esportivo
 * Suporta formatos canônicos e variações comuns em inglês e português.
 */
export const sportEventStatusSchema = z
  .enum([
    "scheduled",
    "in_progress",
    "completed",
    "cancelled",
    "postponed",
    "Scheduled",
    "In Progress",
    "Completed",
    "Cancelled",
    "Postponed",
  ])
  .transform((val): "scheduled" | "in_progress" | "completed" | "cancelled" | "postponed" => {
    const normalized = val.toLowerCase().replace(/[\s-]+/g, "_");
    if (normalized === "in_progress" || normalized === "inprogress" || normalized === "live") {
      return "in_progress";
    }
    if (normalized === "completed" || normalized === "concluido" || normalized === "finalizado") {
      return "completed";
    }
    if (normalized === "cancelled" || normalized === "cancelado") {
      return "cancelled";
    }
    if (normalized === "postponed" || normalized === "adiado") {
      return "postponed";
    }
    return "scheduled";
  });

export type SportEventStatus =
  "scheduled" | "in_progress" | "completed" | "cancelled" | "postponed";

/**
 * Schema Zod completo para Evento Esportivo.
 * Inclui campos obrigatórios: title, sportType, date, time, venue e status.
 */
export const sportEventSchema = z.object({
  id: z
    .string()
    .min(1, "ID do evento é obrigatório")
    .default(() => crypto.randomUUID()),
  title: z
    .string()
    .trim()
    .min(2, "O título do evento deve ter pelo menos 2 caracteres")
    .max(120, "O título do evento deve ter no máximo 120 caracteres"),
  sportType: z
    .string()
    .trim()
    .min(2, "A modalidade esportiva é obrigatória")
    .max(60, "A modalidade esportiva deve ter no máximo 60 caracteres"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "A data deve estar no formato ISO AAAA-MM-DD (ex: 2026-09-15)"),
  time: z
    .string()
    .regex(
      /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/,
      "O horário deve estar no formato HH:mm (ex: 16:00)",
    )
    .nullable()
    .optional()
    .transform((t) => (t ? t.slice(0, 5) : null)),
  venue: z
    .string()
    .trim()
    .max(120, "O local do evento deve ter no máximo 120 caracteres")
    .nullable()
    .optional(),
  status: sportEventStatusSchema.default("scheduled"),

  // Campos adicionais e contextuais de modalidades esportivas
  homeTeam: z.string().trim().max(80).nullable().optional(),
  awayTeam: z.string().trim().max(80).nullable().optional(),
  competition: z.string().trim().max(100).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(2).toUpperCase().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  createdAt: z
    .string()
    .optional()
    .default(() => new Date().toISOString()),
});

/** Schema para criação/edição de evento esportivo */
export const createSportEventSchema = sportEventSchema.omit({
  id: true,
  createdAt: true,
});

export type SportEvent = z.infer<typeof sportEventSchema>;
export type SportEventInput = z.infer<typeof createSportEventSchema>;

/**
 * Interface explícita para tipagem em TypeScript.
 */
export interface ISportEvent {
  id: string;
  title: string;
  sportType: string;
  date: string; // AAAA-MM-DD
  time?: string | null; // HH:mm
  venue?: string | null;
  status: SportEventStatus;
  homeTeam?: string | null;
  awayTeam?: string | null;
  competition?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  createdAt?: string;
}

/**
 * Verifica se um evento esportivo é futuro / próximo.
 */
export function isEventUpcoming(eventDate: string, eventTime?: string | null): boolean {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;

  if (eventDate > todayStr) return true;
  if (eventDate === todayStr) {
    if (!eventTime) return true;
    const currentHourMin = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    return eventTime >= currentHourMin;
  }
  return false;
}

/**
 * Normaliza qualquer valor de status para a chave canônica.
 */
export function normalizeSportEventStatus(rawStatus?: string | null): SportEventStatus {
  if (!rawStatus) return "scheduled";
  const cleaned = rawStatus.toLowerCase().replace(/[\s-]+/g, "_");
  if (cleaned.includes("progress") || cleaned.includes("andamento") || cleaned.includes("live")) {
    return "in_progress";
  }
  if (cleaned.includes("complet") || cleaned.includes("conclui") || cleaned.includes("final")) {
    return "completed";
  }
  if (cleaned.includes("cancel")) {
    return "cancelled";
  }
  if (cleaned.includes("postpon") || cleaned.includes("adia")) {
    return "postponed";
  }
  return "scheduled";
}
