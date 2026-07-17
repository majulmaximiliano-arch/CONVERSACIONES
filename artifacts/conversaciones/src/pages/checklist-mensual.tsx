import { useState } from "react";
import {
  useGetMonthlyStatus,
  getGetMonthlyStatusQueryKey,
  useGetSession,
} from "@workspace/api-client-react";
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ChecklistMensual() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12

  const { data: session } = useGetSession();
  const userId = session?.user?.id;

  const isCurrentOrFuture = year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1);

  const { data: statusList, isLoading } = useGetMonthlyStatus(
    { year, month, userId },
    {
      query: {
        enabled: !!userId,
        queryKey: getGetMonthlyStatusQueryKey({ year, month, userId }),
      },
    }
  );

  const goBack = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const goForward = () => {
    if (isCurrentOrFuture) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Sort: pending first, then al día; within each group sort by marca → tipo → carpeta
  const sorted = [...(statusList ?? [])].sort((a, b) => {
    if (a.hasFileForMonth !== b.hasFileForMonth) return a.hasFileForMonth ? 1 : -1;
    return (
      (a.marcaName ?? "").localeCompare(b.marcaName ?? "") ||
      (a.tipoNegocioName ?? "").localeCompare(b.tipoNegocioName ?? "") ||
      (a.folderName ?? "").localeCompare(b.folderName ?? "")
    );
  });

  const pendingCount = sorted.filter(s => !s.hasFileForMonth).length;
  const doneCount = sorted.filter(s => s.hasFileForMonth).length;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              Checklist Mensual
            </h1>
            <p className="text-muted-foreground mt-1">
              Estado de carga de archivos por carpeta para el período seleccionado.
            </p>
          </div>

          {/* Month picker */}
          <div className="flex items-center gap-2 bg-muted rounded-xl px-2 py-1.5 self-start sm:self-auto">
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-background transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold w-36 text-center select-none">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={goForward}
              disabled={isCurrentOrFuture}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isCurrentOrFuture
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-background"
              )}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary pills */}
        {!isLoading && statusList && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {doneCount} al día
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[22%]">Marca</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-[28%]">Tipo de Negocio</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Carpeta</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground w-[160px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-6 w-20 bg-muted rounded-full animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">Sin carpetas asignadas</p>
                    <p className="text-xs mt-1">No tenés carpetas accesibles para este período.</p>
                  </td>
                </tr>
              ) : (
                sorted.map((item, idx) => {
                  const isDone = item.hasFileForMonth;
                  // Add a subtle separator between pending and done sections
                  const prevIsDone = idx > 0 ? sorted[idx - 1].hasFileForMonth : false;
                  const isSectionBoundary = idx > 0 && isDone && !prevIsDone;

                  return (
                    <tr
                      key={item.folderId}
                      className={cn(
                        "border-b last:border-0 transition-colors",
                        isSectionBoundary && "border-t-2 border-t-border",
                        isDone
                          ? "bg-white dark:bg-background hover:bg-muted/20"
                          : "bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 dark:hover:bg-amber-950/20"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {item.marcaName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.tipoNegocioName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {item.folderName}
                        {isDone && item.latestFileDate && (
                          <span className="block text-xs text-muted-foreground mt-0.5">
                            Último archivo: {formatDate(item.latestFileDate)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full",
                            isDone
                              ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40"
                              : "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40"
                          )}
                        >
                          {isDone
                            ? <><CheckCircle2 className="h-3.5 w-3.5" /> Al día</>
                            : <><AlertCircle className="h-3.5 w-3.5" /> Pendiente</>
                          }
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
