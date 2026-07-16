import { useState } from "react";
import {
  useListMarcas,
  useCreateMarca,
  useUpdateMarca,
  useDeleteMarca,
  useListTiposNegocio,
  useCreateTipoNegocio,
  useUpdateTipoNegocio,
  useDeleteTipoNegocio,
  getListMarcasQueryKey,
  getListTiposNegocioQueryKey,
  Marca,
  TipoNegocio,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2, Plus, MoreVertical, Pencil, Trash2, ChevronDown, ChevronRight, Briefcase,
} from "lucide-react";

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Marca Form Dialog ─────────────────────────────────────────────────────────

function MarcaDialog({
  open, onOpenChange, marca, onSave, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  marca?: Marca | null;
  onSave: (data: { name: string; slug: string; logoUrl?: string; isActive?: boolean }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(marca?.name ?? "");
  const [slug, setSlug] = useState(marca?.slug ?? "");
  const [logoUrl, setLogoUrl] = useState(marca?.logoUrl ?? "");
  const [isActive, setIsActive] = useState(marca?.isActive ?? true);
  const [slugEdited, setSlugEdited] = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{marca ? "Editar Marca" : "Nueva Marca"}</DialogTitle>
          <DialogDescription>Configurá el nombre, slug y estado de la marca.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ej: Volkswagen" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug * <span className="text-muted-foreground text-xs">(identificador URL único)</span></Label>
            <Input
              value={slug}
              onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugEdited(true); }}
              placeholder="Ej: volkswagen"
            />
          </div>
          <div className="space-y-1.5">
            <Label>URL del Logo</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Estado activo</p>
              <p className="text-xs text-muted-foreground">Las marcas inactivas no aparecen en el Centro de Datos.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave({ name: name.trim(), slug, logoUrl: logoUrl.trim() || undefined, isActive })}
            disabled={!name.trim() || !slug || loading}
          >
            {loading ? "Guardando..." : marca ? "Guardar" : "Crear marca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tipo de Negocio inline manager ────────────────────────────────────────────

function TiposNegocioManager({ marcaId }: { marcaId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tipos, isLoading } = useListTiposNegocio(marcaId, {
    query: { queryKey: getListTiposNegocioQueryKey(marcaId) },
  });

  const createTipo = useCreateTipoNegocio();
  const updateTipo = useUpdateTipoNegocio();
  const deleteTipo = useDeleteTipoNegocio();

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTiposNegocioQueryKey(marcaId) });

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTipo.mutate(
      { marcaId, data: { name: newName.trim() } },
      {
        onSuccess: () => { invalidate(); setNewName(""); toast({ title: "Tipo creado" }); },
        onError: () => toast({ title: "Error al crear", variant: "destructive" }),
      },
    );
  };

  const handleUpdate = (tipoId: number) => {
    if (!editName.trim()) return;
    updateTipo.mutate(
      { marcaId, tipoNegocioId: tipoId, data: { name: editName.trim() } },
      {
        onSuccess: () => { invalidate(); setEditId(null); toast({ title: "Tipo actualizado" }); },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (tipo: TipoNegocio) => {
    if (!confirm(`¿Eliminar "${tipo.name}"? También se eliminarán sus carpetas.`)) return;
    deleteTipo.mutate(
      { marcaId, tipoNegocioId: tipo.id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Tipo eliminado" }); },
        onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-2 pt-2 pb-1">
      {isLoading ? (
        <p className="text-sm text-muted-foreground px-2">Cargando...</p>
      ) : tipos?.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">Sin tipos de negocio aún.</p>
      ) : (
        tipos?.map((tipo) => (
          <div key={tipo.id} className="flex items-center gap-2 px-2">
            {editId === tipo.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(tipo.id); if (e.key === "Escape") setEditId(null); }}
                  autoFocus
                />
                <Button size="sm" className="h-8" onClick={() => handleUpdate(tipo.id)}>Guardar</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>✕</Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-1">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{tipo.name}</span>
                  <span className="text-xs text-muted-foreground">({tipo.folderCount} carpetas)</span>
                </div>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0"
                  onClick={() => { setEditId(tipo.id); setEditName(tipo.name); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(tipo)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))
      )}
      {/* Add new */}
      <div className="flex items-center gap-2 px-2 pt-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nuevo tipo de negocio..."
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
        />
        <Button size="sm" className="h-8 gap-1.5" onClick={handleCreate} disabled={!newName.trim() || createTipo.isPending}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminMarcas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: marcas, isLoading } = useListMarcas({}, { query: { queryKey: getListMarcasQueryKey({}) } });

  const createMarca = useCreateMarca();
  const updateMarca = useUpdateMarca();
  const deleteMarca = useDeleteMarca();

  const [createOpen, setCreateOpen] = useState(false);
  const [editMarca, setEditMarca] = useState<Marca | null>(null);
  const [openTipos, setOpenTipos] = useState<Set<number>>(new Set());

  const invalidateMarcas = () =>
    queryClient.invalidateQueries({ queryKey: getListMarcasQueryKey({}) });

  const handleCreate = (data: Parameters<typeof createMarca.mutate>[0]["data"]) => {
    createMarca.mutate(
      { data },
      {
        onSuccess: () => { invalidateMarcas(); setCreateOpen(false); toast({ title: "Marca creada" }); },
        onError: () => toast({ title: "Error al crear", variant: "destructive" }),
      },
    );
  };

  const handleEdit = (data: Parameters<typeof updateMarca.mutate>[0]["data"]) => {
    if (!editMarca) return;
    updateMarca.mutate(
      { marcaId: editMarca.id, data },
      {
        onSuccess: () => { invalidateMarcas(); setEditMarca(null); toast({ title: "Marca actualizada" }); },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (marca: Marca) => {
    if (!confirm(`¿Eliminar "${marca.name}"? Esto eliminará todos sus tipos de negocio y carpetas.`)) return;
    deleteMarca.mutate(
      { marcaId: marca.id },
      {
        onSuccess: () => { invalidateMarcas(); toast({ title: "Marca eliminada" }); },
        onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
      },
    );
  };

  const toggleTipos = (marcaId: number) => {
    setOpenTipos((prev) => {
      const next = new Set(prev);
      if (next.has(marcaId)) next.delete(marcaId);
      else next.add(marcaId);
      return next;
    });
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Marcas</h1>
            <p className="text-muted-foreground mt-1">
              Administrá las marcas y sus tipos de negocio.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Building2 className="h-4 w-4" /> Nueva Marca
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-8" />
                  <TableHead>Marca</TableHead>
                  <TableHead>Tipos de Negocio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Cargando...</TableCell>
                  </TableRow>
                ) : marcas?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No hay marcas. Creá la primera.
                    </TableCell>
                  </TableRow>
                ) : (
                  marcas?.map((marca) => {
                    const isOpen = openTipos.has(marca.id);
                    return [
                      <TableRow key={`${marca.id}-row`} className="group">
                        <TableCell className="w-8">
                          <button
                            onClick={() => toggleTipos(marca.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
                              {marca.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{marca.name}</div>
                              <div className="text-xs text-muted-foreground">{marca.slug}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {marca.tipoNegocioCount} tipo{marca.tipoNegocioCount !== 1 ? "s" : ""}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={marca.isActive
                              ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800"
                              : "text-muted-foreground"}
                          >
                            {marca.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditMarca(marca)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(marca)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>,
                      isOpen && (
                        <TableRow key={`${marca.id}-tipos`} className="hover:bg-transparent">
                          <TableCell />
                          <TableCell colSpan={4} className="py-2 bg-muted/20">
                            <TiposNegocioManager marcaId={marca.id} />
                          </TableCell>
                        </TableRow>
                      ),
                    ];
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <MarcaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        loading={createMarca.isPending}
      />

      {editMarca && (
        <MarcaDialog
          open={!!editMarca}
          onOpenChange={(v) => !v && setEditMarca(null)}
          marca={editMarca}
          onSave={handleEdit}
          loading={updateMarca.isPending}
        />
      )}
    </div>
  );
}
