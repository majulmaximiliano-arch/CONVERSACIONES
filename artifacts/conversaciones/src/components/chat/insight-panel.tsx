import { KpiItem } from "@workspace/api-client-react";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightPanelProps {
  kpis?: KpiItem[];
  insights?: string[];
  filesConsulted?: string[];
}

export function InsightPanel({ kpis, insights, filesConsulted }: InsightPanelProps) {
  if (!kpis?.length && !insights?.length && !filesConsulted?.length) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center text-muted-foreground text-sm">
        <p>El análisis y KPIs de la respuesta actual aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {kpis && kpis.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Métricas Clave</h3>
          <div className="grid gap-4">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-card border rounded-xl p-4 shadow-sm">
                <div className="text-sm text-muted-foreground mb-1">{kpi.label}</div>
                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                {kpi.change && (
                  <div className={cn(
                    "flex items-center text-xs mt-2 font-medium",
                    kpi.trend === 'up' ? "text-emerald-600 dark:text-emerald-500" :
                    kpi.trend === 'down' ? "text-destructive" :
                    "text-muted-foreground"
                  )}>
                    {kpi.trend === 'up' && <ArrowUpIcon className="h-3 w-3 mr-1" />}
                    {kpi.trend === 'down' && <ArrowDownIcon className="h-3 w-3 mr-1" />}
                    {kpi.trend === 'neutral' && <ArrowRightIcon className="h-3 w-3 mr-1" />}
                    {kpi.change}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Observaciones</h3>
          <ul className="space-y-3">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-card-foreground leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filesConsulted && filesConsulted.length > 0 && (
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Fuentes</h3>
          <div className="flex flex-wrap gap-2">
            {filesConsulted.map((file, i) => (
              <div key={i} className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground border font-mono">
                {file}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
