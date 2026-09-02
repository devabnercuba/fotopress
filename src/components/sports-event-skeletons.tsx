import React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeleton individual de card de evento esportivo
 */
export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-border/50">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 w-36 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Skeleton para a lista de eventos esportivos
 */
export function EventListSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={`skeleton-card-${i}`} />
      ))}
    </div>
  );
}

/**
 * Skeleton completo para a tela do calendário esportivo
 */
export function SportsCalendarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6 w-full animate-pulse", className)}>
      {/* Barra de busca e filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Skeleton className="h-10 w-full md:max-w-md rounded-lg" />
          <div className="flex gap-2 w-full md:w-auto">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel do Calendário */}
        <Card className="lg:col-span-5 border-border">
          <CardHeader className="space-y-2 pb-2">
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-60 rounded-md" />
          </CardHeader>
          <CardContent className="p-4 flex justify-center">
            <Skeleton className="h-72 w-full max-w-xs rounded-xl" />
          </CardContent>
        </Card>

        {/* Painel de Lista de Jogos */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <EventListSkeleton count={4} />
        </div>
      </div>
    </div>
  );
}
