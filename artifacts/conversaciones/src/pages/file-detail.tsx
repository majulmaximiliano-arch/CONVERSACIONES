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
import { ChevronLeft, FileSpreadsheet, Save, CheckCircle2, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { es } from "date-fns/locale";
import { format } from "date-fns";

const TYPE_LABELS: Record<FileColumnDetectedType, string> = {
  number: 'Número',
  date: 'Fecha',
  category: 'Categoría',
  percentage: 'Porcentaje',
  text: 'Texto'
};

export function FileDetail() {
  const { folderId, fileId } = useParams();
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

  // Initialize state when file loads
  useState(() => {
    if (file && columns.length === 0) {
      setBrand(file.brand || "");
      setPeriodMonth(file.periodMonth ? String(file.periodMonth) : "");
      setPeriodYear(file.periodYear ? String(file.periodYear) : "");
      setColumns(file.columns.map(c => ({
        id: c.id,
        detectedType: c.detectedType,
        isMetric: c.isMetric,
        isDimension: c.isDimension
      })));
    }
  });

  // Re-sync if file changes after confirmation
  if (file && columns.length === 0) {
      setBrand(file.brand || "");
      setPeriodMonth(file.periodMonth ? String(file.periodMonth) : "");
      setPeriodYear(file.periodYear ? String(file.periodYear) : "");
      setColumns(file.columns.map(c => ({
        id: c.id,
        detectedType: c.detectedType,
        isMetric: c.isMetric,
        isDimension: c.isDimension
      })));
  }

  const handleUpdateColumn = (id: number, key: string, value: any) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c));
  };

  const handleConfirm = () => {
    confirmFile.mutate(
      { 
        fileId: fileIdNum, 
        data: {
          brand: brand || undefined,
          periodMonth: periodMonth ? Number(periodMonth) : undefined,
          periodYear: periodYear ? Number(periodYear) : undefined,
          columns
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFileQueryKey(fileIdNum) });
          queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(folderIdNum) });
          toast({ title: "Archivo confirmado", description: "La configuración ha sido guardada." });
          setLocation(`/data-center/${folderIdNum}`);
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo confirmar el archivo.", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="p-8">Cargando...</div>;
  }

  if (!file) {
    return <div className="p-8">Archivo no encontrado</div>;
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="border-b px-8 py-4 flex items-center justify-between bg-card/50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/data-center/${folderIdNum}`)} className="shrink-0 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{file.originalFilename}</h1>
                {file.status === 'confirmed' ? (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 border-0">
                    <CheckCircle2 className="h-3 w-3" /> Confirmado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 gap-1">
                    <FileWarning className="h-3 w-3" /> Pendiente Revisión
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {file.rowCount} filas • {file.columnCount} columnas
              </p>
            </div>
          </div>
        </div>
        <Button onClick={handleConfirm} disabled={confirmFile.isPending} className="gap-2">
          <Save className="h-4 w-4" /> Confirmar Configuración
        </Button>
      </div>

      <div className="p-8 space-y-8 max-w-6xl mx-auto w-full">
        
        {/* Metadatos Globales */}
        <Card>
          <CardHeader>
            <CardTitle>Contexto del Archivo</CardTitle>
            <CardDescription>
              Añade el periodo y marca al que corresponde este archivo para que el analista lo identifique correctamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Marca / Entidad</Label>
                <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej. Ventas Norte" />
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Select value={periodYear} onValueChange={setPeriodYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el año" />
                  </SelectTrigger>
                  <SelectContent>
                    {[2022, 2023, 2024, 2025].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={periodMonth} onValueChange={setPeriodMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => {
                      const date = new Date(); date.setMonth(m - 1);
                      return <SelectItem key={m} value={String(m)} className="capitalize">{format(date, 'MMMM', {locale: es})}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Columnas */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Columnas</CardTitle>
            <CardDescription>
              Revisa que el tipo de dato y su rol (Métrica = valores medibles, Dimensión = atributos para agrupar) sean correctos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Nombre</TableHead>
                  <TableHead className="w-[200px]">Tipo Detectado</TableHead>
                  <TableHead className="text-center">Métrica</TableHead>
                  <TableHead className="text-center">Dimensión</TableHead>
                  <TableHead>Ejemplos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {file.columns.map((col, index) => {
                  const stateCol = columns.find(c => c.id === col.id) || col;
                  return (
                    <TableRow key={col.id}>
                      <TableCell className="font-medium">{col.name}</TableCell>
                      <TableCell>
                        <Select 
                          value={stateCol.detectedType} 
                          onValueChange={(val) => handleUpdateColumn(col.id, 'detectedType', val)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TYPE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch 
                          checked={stateCol.isMetric} 
                          onCheckedChange={(checked) => handleUpdateColumn(col.id, 'isMetric', checked)} 
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch 
                          checked={stateCol.isDimension} 
                          onCheckedChange={(checked) => handleUpdateColumn(col.id, 'isDimension', checked)} 
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={col.sampleValues?.join(', ')}>
                        {col.sampleValues?.slice(0, 3).join(', ')}...
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Vista Previa */}
        {file.previewRows && file.previewRows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Vista Previa de Datos</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {file.columns.map(c => (
                      <TableHead key={c.id} className="whitespace-nowrap">{c.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {file.previewRows.map((row: any, i) => (
                    <TableRow key={i}>
                      {file.columns.map(c => (
                        <TableCell key={`${i}-${c.id}`} className="whitespace-nowrap truncate max-w-[150px]">
                          {String(row[c.name] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        
        {/* Spacer for bottom padding */}
        <div className="h-4"></div>
      </div>
    </div>
  );
}
