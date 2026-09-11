import { format, parseISO } from "date-fns";
import type { ISportEvent, SportEvent } from "@/schemas/sport-event";
import type { Match } from "./queries";
import type { SportEvent as AgendaSportEvent } from "./events";

/**
 * Formata uma data e hora para o padrão iCalendar UTC (YYYYMMDDTHHmmssZ)
 * ou local flutuante (YYYYMMDDTHHmmss).
 */
function toIcsDateString(
  dateStr: string,
  timeStr?: string | null,
  durationHours = 2,
): {
  dtStart: string;
  dtEnd: string;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  const time = timeStr ? timeStr.slice(0, 5) : "16:00";
  const [hours, minutes] = time.split(":").map(Number);

  const startDate = new Date(year, month - 1, day, hours, minutes, 0);
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, "0");

  const dtStart = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(
    startDate.getDate(),
  )}T${pad(startDate.getHours())}${pad(startDate.getMinutes())}00`;

  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(
    endDate.getDate(),
  )}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  return { dtStart, dtEnd };
}

/**
 * Gera e baixa um arquivo .ics (iCalendar RFC 5545) para o evento esportivo.
 * Compatível com Apple Calendar, Google Agenda, Microsoft Outlook e outros.
 */
export function exportEventToIcs(event: SportEvent | ISportEvent): void {
  const { dtStart, dtEnd } = toIcsDateString(event.date, event.time);
  const nowStr = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");

  const summary =
    event.homeTeam && event.awayTeam ? `${event.homeTeam} × ${event.awayTeam}` : event.title;

  const locationParts = [event.venue, event.city, event.state].filter(Boolean);
  const location = locationParts.join(", ");

  const descriptionParts = [
    `Evento: ${summary}`,
    event.sportType ? `Modalidade: ${event.sportType}` : null,
    event.competition ? `Competição: ${event.competition}` : null,
    location ? `Local: ${location}` : null,
    event.notes ? `Observações: ${event.notes}` : null,
  ].filter(Boolean);

  const description = descriptionParts.join("\\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EsportesHub//Sports Event Calendar//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:sports-event-${event.id}@esporteshub.com`,
    `DTSTAMP:${nowStr}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary.replace(/,/g, "\\,")}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location.replace(/,/g, "\\,")}` : "",
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Lembrete de Cobertura — 30 minutos antes",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([icsLines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // Sanitiza o nome do arquivo
  const safeFilename = summary
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  link.href = url;
  link.setAttribute("download", `${safeFilename || "evento-esportivo"}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera URL direta para adicionar o evento ao Google Calendar via web.
 */
export function getGoogleCalendarUrl(event: SportEvent | ISportEvent): string {
  const { dtStart, dtEnd } = toIcsDateString(event.date, event.time);
  const summary =
    event.homeTeam && event.awayTeam ? `${event.homeTeam} × ${event.awayTeam}` : event.title;

  const locationParts = [event.venue, event.city, event.state].filter(Boolean);
  const location = locationParts.join(", ");

  const details = [
    event.sportType ? `Modalidade: ${event.sportType}` : null,
    event.competition ? `Competição: ${event.competition}` : null,
    location ? `Local: ${location}` : null,
    event.notes ? `Observações: ${event.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${dtStart}/${dtEnd}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Compartilha ou copia as informações do evento esportivo.
 * Utiliza a Web Share API quando disponível no dispositivo ou copia para o clipboard.
 */
export async function shareSportsEvent(
  event: SportEvent | ISportEvent,
): Promise<{ method: "share" | "clipboard"; success: boolean }> {
  const summary =
    event.homeTeam && event.awayTeam ? `${event.homeTeam} × ${event.awayTeam}` : event.title;

  const dateFormatted = event.date ? format(parseISO(event.date), "dd/MM/yyyy") : "";
  const timeFormatted = event.time ? ` às ${event.time}` : "";
  const location = [event.venue, event.city, event.state].filter(Boolean).join(", ");

  const shareText = [
    `🏆 ${summary}`,
    event.competition ? `🏅 ${event.competition}` : null,
    `📅 ${dateFormatted}${timeFormatted}`,
    location ? `📍 ${location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const shareData = {
    title: summary,
    text: shareText,
    url: typeof window !== "undefined" ? window.location.href : "",
  };

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return { method: "share", success: true };
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return { method: "share", success: false };
      }
    }
  }

  // Fallback: copiar para área de transferência
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
    return { method: "clipboard", success: true };
  }

  return { method: "clipboard", success: false };
}

/**
 * Converte uma partida cadastrada (Match) no formato de evento para ICS.
 */
export function matchToSportEvent(match: Match): ISportEvent {
  return {
    id: match.id,
    title: `${match.home_team} × ${match.away_team}`,
    sportType: match.competition?.sport_key ?? "Futebol",
    date: match.date,
    time: match.time ? match.time.slice(0, 5) : "16:00",
    venue: match.venue,
    city: match.city,
    state: match.state,
    competition: match.competition?.name,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
    notes: match.notes,
    status: "scheduled",
  };
}

/**
 * Converte um evento esportivo cadastrado na agenda (SportEvent) para o formato de exportação.
 */
export function agendaSportEventToExport(event: AgendaSportEvent): ISportEvent {
  return {
    id: event.id,
    title: event.name,
    sportType: event.sport,
    date: event.start_date,
    time: event.start_time ? event.start_time.slice(0, 5) : "08:00",
    venue: event.venue,
    city: event.city,
    state: event.state,
    notes: [event.notes, event.organizer ? `Organizador: ${event.organizer}` : null]
      .filter(Boolean)
      .join(" | "),
    status: "scheduled",
  };
}

/**
 * Exporta uma partida (Match) individual para arquivo .ics
 */
export function exportMatchToIcs(
  match: Match,
  notes?: string | null,
  status?: string | null,
): void {
  const ev = matchToSportEvent(match);
  if (notes?.trim()) {
    ev.notes = [ev.notes, `Notas da cobertura: ${notes.trim()}`].filter(Boolean).join(" | ");
  }
  if (status) {
    ev.status = status === "cancelled" ? "cancelled" : "scheduled";
  }
  exportEventToIcs(ev);
}

/**
 * Exporta um evento da agenda (SportEvent) individual para arquivo .ics
 */
export function exportAgendaSportEventToIcs(
  event: AgendaSportEvent,
  notes?: string | null,
  status?: string | null,
): void {
  const ev = agendaSportEventToExport(event);
  if (notes?.trim()) {
    ev.notes = [ev.notes, `Notas da cobertura: ${notes.trim()}`].filter(Boolean).join(" | ");
  }
  if (status) {
    ev.status = status === "cancelled" ? "cancelled" : "scheduled";
  }
  exportEventToIcs(ev);
}

/**
 * Gera e baixa um arquivo .ics contendo múltiplos eventos/jogos da agenda do usuário.
 */
export function exportAgendaToIcs(
  items: Array<{
    type: "match" | "event";
    match?: Match | null;
    event?: AgendaSportEvent | null;
    notes?: string | null;
    status?: "confirmed" | "pending" | "cancelled" | string | null;
  }>,
  calendarTitle = "Minha Agenda — FotoPress",
): void {
  if (!items || items.length === 0) return;

  const nowStr = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");

  const veventBlocks: string[] = [];

  for (const item of items) {
    let ev: ISportEvent | null = null;
    if (item.type === "match" && item.match) {
      ev = matchToSportEvent(item.match);
    } else if (item.type === "event" && item.event) {
      ev = agendaSportEventToExport(item.event);
    }

    if (!ev || !ev.date) continue;

    const { dtStart, dtEnd } = toIcsDateString(ev.date, ev.time);
    const summary = ev.homeTeam && ev.awayTeam ? `${ev.homeTeam} × ${ev.awayTeam}` : ev.title;

    const locationParts = [ev.venue, ev.city, ev.state].filter(Boolean);
    const location = locationParts.join(", ");

    const customNotes = item.notes?.trim();

    const descriptionParts = [
      `Evento: ${summary}`,
      ev.sportType ? `Modalidade: ${ev.sportType}` : null,
      ev.competition ? `Competição: ${ev.competition}` : null,
      location ? `Local: ${location}` : null,
      ev.notes ? `Observações do evento: ${ev.notes}` : null,
      customNotes ? `Notas da cobertura: ${customNotes}` : null,
    ].filter(Boolean);

    const description = descriptionParts.join("\\n");

    let icsStatus = "CONFIRMED";
    if (item.status === "cancelled" || item.status === "denied") {
      icsStatus = "CANCELLED";
    } else if (item.status === "pending" || item.status === "requested") {
      icsStatus = "TENTATIVE";
    }

    const block = [
      "BEGIN:VEVENT",
      `UID:fotopress-${ev.id}@fotopress.app`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary.replace(/,/g, "\\,")}`,
      `DESCRIPTION:${description}`,
      location ? `LOCATION:${location.replace(/,/g, "\\,")}` : "",
      `STATUS:${icsStatus}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Lembrete de Cobertura — 30 minutos antes",
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");

    veventBlocks.push(block);
  }

  if (veventBlocks.length === 0) return;

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FotoPress//Sports Agenda//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarTitle}`,
    ...veventBlocks,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const safeFilename = calendarTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  link.href = url;
  link.setAttribute("download", `${safeFilename || "agenda-fotopress"}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
