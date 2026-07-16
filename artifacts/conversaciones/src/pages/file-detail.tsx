import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetFile, 
  useConfirmFile,
  getGetFileQueryKey,
  getGetFolderQueryKey,
  FileColumnDetectedType
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, FileSpreadsheet, Save, CheckCircle2, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import { Link as WouterLink } from "wouter";

const TYPE_LABELS: Record<FileColumnDetectedType, string> = {
  number: 'Número',
  date: 'Fecha',
  category: 'Categoría',
  percentage: 'Porcentaje',
  text: 'Texto'
};

export function FileDetail() {
  const { marcaId, tipoNegocioId, folderId, fileId } = useParams<{
    marcaId: string;
    tipoNegocioId: string;
    folderId: string;
    fileId: string;
  }>();
  const folderIdNum = Number(folderId);
  const fileIdNum = Number(fileId);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: file, isLoading } = useGetFile(
    fileIdNum,
    { query: { enabled: !!fileIdNum, queryKey: getGetFileQueryKey(fileIdNum) } }
  );

  const confirmFile = useConfirmFile();

  const [brand, setBrand] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [columns, setColumns] = useState<any[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (file && !initialized) {
    setBrand(file.brand ?? "");
    setPeriodMonth(file.periodMonth ? String(file.periodMonth) : "");
    setPeriodYear(file.periodYear ? String(file.periodYear) : "");
    setColumns(
      file.columns.map((c: any) => ({
        id: c.id,
        detectedType: c.detectedType,
        isMetric: c.isMetric,
        isDimension: c.isDimension,
      }))
    );
    setInitialized(true);
  }

  const handleConfirm = () => {
    confirmFile.mutate(
      {
        fileId: fileIdNum,
        data: {
          brand: brand || undefined,
          periodMonth: periodMonth ? Number(periodMonth) : undefined,
          periodYear: periodYear ? Number(periodYear) : undefined,
          columns,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Archivo confirmado", description: "El archivo está listo para análisis." });
          queryClient.invalidateQueries({ queryKey: getGetFileQueryKey(fileIdNum) });
          queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderIdNum) });
          setLocation(`/data-center/${marcaId}/${tipoNegocioId}/${folderId}`);
        },
        onError: () => toast({ title: "Error al confirmar", variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Cargando archivo...</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Archivo no encontrado.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card px-8 py-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
          <WouterLink href="/data-center" className="hover:text-foreground transition-colors">
            Centro de Datos
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <WouterLink href={`/data-center/${marcaId}`} className="hover:text-foreground transition-colors">
            Marca
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <WouterLink href={`/data-center/${marcaId}/${tipoNegocioId}`} className="hover:text-foreground transition-colors">
            Tipo de Negocio
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <WouterLink href={`/data-center/${marcaId}/${tipoNegocioId}/${folderId}`} className="hover:text-foreground transition-colors">
            Carpeta
          </WouterLink>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{file.originalFilename}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">{file.originalFilename}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {file.rowCount?.toLocaleString("es-AR")} filas · {file.sheetCount} hojas ·{" "}
                {file.columnCount} columnas · {format(new Date(file.uploadedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>
          </div>
          {file.status === "confirmed" ? (
            <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
              <FileWarning className="h-3.5 w-3.5" /> Pendiente de confirmación
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metadatos del archivo</CardTitle>
              <CardDescription>Revisá y corregí la detección automática del período y marca.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Marca del archivo</Label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Detectado automáticamente..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mes</Label>
                <Input
                  type="number" min="1" max="12"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  placeholder="1-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Año</Label>
                <Input
                  type="number" min="2000" max="2099"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  placeholder="2024"
                />
              </div>
            </CardContent>
          </Card>

          {/* Columns */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Columnas detectadas</CardTitle>
              <CardDescription>
                Revisá el tipo de dato detectado y marcá cuáles son métricas y cuáles dimensiones.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Columna</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Métrica</TableHead>
                    <TableHead className="text-center">Dimensión</TableHead>
                    <TableHead>Valores de muestra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {file.columns.map((col: any, idx: number) => {
                    const colState = columns[idx] ?? { id: col.id, detectedType: col.detectedType, isMetric: col.isMetric, isDimension: col.isDimension };
                    return (
                      <TableRow key={col.id}>
                        <TableCell className="font-medium text-sm">{col.name}</TableCell>
                        <TableCell>
                          <Select
                            value={colState.detectedType}
                            onValueChange={(v) => {
                              const next = [...columns];
                              if (!next[idx]) next[idx] = { ...colState };
                              next[idx].detectedType = v;
                              setColumns(next);
                            }}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TYPE_LABELS) as FileColumnDetectedType[]).map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{TYPE_LABELS[t]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={colState.isMetric}
                            onCheckedChange={(v) => {
                              const next = [...columns];
                              if (!next[idx]) next[idx] = { ...colState };
                              next[idx].isMetric = v;
                              setColumns(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={colState.isDimension}
                            onCheckedChange={(v) => {
                              const next = [...columns];
                              if (!next[idx]) next[idx] = { ...colState };
                              next[idx].isDimension = v;
                              setColumns(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {col.sampleValues?.slice(0, 3).join(", ")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {file.status === "pending" && (
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={handleConfirm}
                disabled={confirmFile.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {confirmFile.isPending ? "Confirmando..." : "Confirmar y activar archivo"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
