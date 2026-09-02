import { format, parseISO } from "date-fns";
import type { ISportEvent, SportEvent } from "@/schemas/sport-event";

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
