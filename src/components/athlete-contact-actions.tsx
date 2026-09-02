import { Instagram, Mail, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { whatsappLink, type Athlete } from "@/lib/athletes";

/** Ações rápidas de contato — só aparecem quando o dado existe. */
export function AthleteContactActions({
  athlete,
  size = "sm",
}: {
  athlete: Pick<Athlete, "phone" | "whatsapp" | "email" | "instagram">;
  size?: "sm" | "icon";
}) {
  const wa = whatsappLink(athlete.whatsapp);
  const actions: { key: string; label: string; href: string; icon: typeof Phone }[] = [
    ...(wa ? [{ key: "wa", label: "WhatsApp", href: wa, icon: MessageCircle }] : []),
    ...(athlete.phone
      ? [
          {
            key: "tel",
            label: "Ligar",
            href: `tel:${athlete.phone.replace(/[^\d+]/g, "")}`,
            icon: Phone,
          },
        ]
      : []),
    ...(athlete.email
      ? [{ key: "mail", label: "E-mail", href: `mailto:${athlete.email}`, icon: Mail }]
      : []),
    ...(athlete.instagram
      ? [
          {
            key: "ig",
            label: "Instagram",
            href: `https://instagram.com/${athlete.instagram.replace(/^@/, "")}`,
            icon: Instagram,
          },
        ]
      : []),
  ];

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((action) => (
        <Button key={action.key} asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
          <a href={action.href} target="_blank" rel="noreferrer" aria-label={action.label}>
            <action.icon className="size-3.5" />
            {size === "sm" && action.label}
          </a>
        </Button>
      ))}
    </div>
  );
}
