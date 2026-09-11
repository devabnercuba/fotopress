import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { isRadarEnabled } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [{ title: "Radar — FotoPress" }],
  }),
  component: RadarRouteComponent,
});

function RadarRouteComponent() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isRadarEnabled()) {
      toast.info("O módulo Radar está temporariamente desativado.");
      navigate({ to: "/agenda", replace: true });
    }
  }, [navigate]);

  if (!isRadarEnabled()) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-lg font-semibold">Módulo Radar Desativado</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O módulo Radar da Partida está temporariamente em manutenção e desativado. Redirecionando
          para a sua agenda...
        </p>
      </div>
    );
  }

  return null;
}
