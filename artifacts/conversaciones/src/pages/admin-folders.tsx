import { useState } from "react";
import {
  useListFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useListMarcas,
  useListTiposNegocio,
  useGrantFolderPermission,
  useRevokeFolderPermission,
  useListUsers,
  useGetFolderPermissions,
  getListFoldersQueryKey,
  getGetFolderPermissionsQueryKey,
  getListTiposNegocioQueryKey,
  Folder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderPlus, MoreVertical, Pencil, Trash2, Users, X } from "lucide-react";

const COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#06B6D4", "#F97316", "#84CC16",
  "#EC4899", "#6B7280",
];

// ── Folder Form Dialog ────────────────────────────────────────────────────────

function FolderFormDialog({
  open, onOpenChange, folder, onSave, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  folder?: Folder | null;
  onSave: (data: { tipoNegocioId: number; name: string; description?: string; color?: string }) => void;
  loading: boolean;
}) {
  const [marcaId, setMarcaId] = useState<number | null>(
    folder ? null : null // Will try to derive from folder if needed
  );
  const [tipoNegocioId, setTipoNegocioId] = useState<number | null>(folder?.tipoNegocioId ?? null);
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [color, setColor] = useState(folder?.color ?? "#3B82F6");

  const { data: marcas } = useListMarcas({});
  const { data: tipos } = useListTiposNegocio(marcaId!, {
    query: { enabled: !!marcaId, queryKey: getListTiposNegocioQueryKey(marcaId!) },
  });

  // If editing, try to find the marca from the folder's tipoNegocioName/marcaId
  const initialMarcaId = folder?.marcaId ?? null;
  const [derivedMarcaId, setDerivedMarcaId] = useState<number | null>(initialMarcaId);
  const effectiveMarcaId = marcaId ?? derivedMarcaId;

  const { data: tiposForEdit } = useListTiposNegocio(effectiveMarcaId!, {
    query: { enabled: !!effectiveMarcaId, queryKey: getListTiposNegocioQueryKey(effectiveMarcaId!) },
  });

  const allTipos = tipos ?? tiposForEdit ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{folder ? "Editar Carpeta" : "Nueva Carpeta"}</DialogTitle>
          <DialogDescription>
            Seleccioná la marca, tipo de negocio y completá los datos de la carpeta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Marca selector */}
          {!folder && (
            <div className="space-y-1.5">
              <Label>Marca *</Label>
              <Select
                value={marcaId ? String(marcaId) : ""}
                onValueChange={(v) => {
                  setMarcaId(Number(v));
                  setTipoNegocioId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná una marca..." />
                </SelectTrigger>
                <SelectContent>
                  {marcas?.filter((m) => m.isActive).map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tipo de negocio selector */}
          <div className="space-y-1.5">
            <Label>Tipo de Negocio *</Label>
            {folder ? (
              <div className="text-sm p-2 bg-muted rounded-md text-muted-foreground">
                {folder.marcaName} → {folder.tipoNegocioName} <span className="text-xs">(no se puede cambiar)</span>
              </div>
            ) : (
              <Select
                value={tipoNegocioId ? String(tipoNegocioId) : ""}
                onValueChange={(v) => setTipoNegocioId(Number(v))}
                disabled={!effectiveMarcaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={effectiveMarcaId ? "Seleccioná un tipo..." : "Primero elegí una marca"} />
                </SelectTrigger>
                <SelectContent>
                  {allTipos?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Patentamientos"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              onSave({
                tipoNegocioId: tipoNegocioId ?? folder!.tipoNegocioId,
                name: name.trim(),
                description: description.trim() || undefined,
                color,
              })
            }
            disabled={!name.trim() || (!folder && !tipoNegocioId) || loading}
          >
            {loading ? "Guardando..." : folder ? "Guardar" : "Crear carpeta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Permissions Dialog ────────────────────────────────────────────────────────

function PermissionsDialog({
  folderId, folderName, open, onOpenChange,
}: {
  folderId: number;
  folderName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: users } = useListUsers();
  const { data: permissions } = useGetFolderPermissions(folderId, {
    query: { queryKey: getGetFolderPermissionsQueryKey(folderId) },
  });
  const grantPermission = useGrantFolderPermission();
  const revokePermission = useRevokeFolderPermission();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetFolderPermissionsQueryKey(folderId) });

  const permittedIds = new Set(permissions?.map((p) => p.userId) ?? []);
  const availableUsers = users?.filter((u) => u.role === "analyst" && !permittedIds.has(u.id)) ?? [];

  const handleGrant = () => {
    if (!selectedUserId) return;
    grantPermission.mutate(
      { folderId, data: { userId: Number(selectedUserId) } },
      { onSuccess: () => { invalidate(); setSelectedUserId(""); }, onError: () => toast({ title: "Error", variant: "destructive" }) },
    );
  };

  const handleRevoke = (userId: number) => {
    revokePermission.mutate(
      { folderId, userId },
      { onSuccess: invalidate, onError: () => toast({ title: "Error", variant: "destructive" }) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permisos — {folderName}</DialogTitle>
          <DialogDescription>Gestioná qué analistas tienen acceso a esta carpeta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleccioná un analista..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGrant} disabled={!selectedUserId || grantPermission.isPending}>
              Agregar
            </Button>
          </div>

          {permissions && permissions.length > 0 ? (
            <div className="space-y-2">
              {permissions.map((p) => (
                <div key={p.userId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{p.userName ?? `User ${p.userId}`}</p>
                    <p className="text-xs text-muted-foreground">{p.userEmail}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRevoke(p.userId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Sin permisos individuales asignados.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminFolders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: folders, isLoading } = useListFolders(
    {},
    { query: { queryKey: getListFoldersQueryKey({}) } }
  );

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [permFolder, setPermFolder] = useState<Folder | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey({}) });

  const handleCreate = (data: { tipoNegocioId: number; name: string; description?: string; color?: string }) => {
    createFolder.mutate(
      { data },
      {
        onSuccess: () => { invalidate(); setCreateOpen(false); toast({ title: "Carpeta creada" }); },
        onError: () => toast({ title: "Error al crear", variant: "destructive" }),
      },
    );
  };

  const handleEdit = (data: { tipoNegocioId: number; name: string; description?: string; color?: string }) => {
    if (!editFolder) return;
    const { tipoNegocioId: _, ...updateData } = data;
    updateFolder.mutate(
      { folderId: editFolder.id, data: updateData },
      {
        onSuccess: () => { invalidate(); setEditFolder(null); toast({ title: "Carpeta actualizada" }); },
        onError: () => toast({ title: "Error al actualizar", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (folder: Folder) => {
    if (!confirm(`¿Eliminar "${folder.name}"? También se eliminarán todos sus archivos.`)) return;
    deleteFolder.mutate(
      { folderId: folder.id },
      {
        onSuccess: () => { invalidate(); toast({ title: "Carpeta eliminada" }); },
        onError: () => toast({ title: "Error al eliminar", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestión de Carpetas</h1>
            <p className="text-muted-foreground mt-1">
              Administrá las carpetas de datos y sus permisos por analista.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <FolderPlus className="h-4 w-4" /> Nueva Carpeta
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Carpeta</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Tipo de Negocio</TableHead>
                  <TableHead>Archivos</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Cargando...</TableCell>
                  </TableRow>
                ) : folders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No hay carpetas. Primero creá marcas y tipos de negocio en <span className="font-medium">Marcas</span>.
                    </TableCell>
                  </TableRow>
                ) : (
                  folders?.map((folder) => (
                    <TableRow key={folder.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3.5 w-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: folder.color ?? "#6B7280" }}
                          />
                          <div>
                            <div className="font-medium text-sm">{folder.name}</div>
                            {folder.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1">{folder.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{folder.marcaName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{folder.tipoNegocioName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{folder.fileCount}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPermFolder(folder)}>
                              <Users className="mr-2 h-4 w-4" /> Permisos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditFolder(folder)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(folder)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <FolderFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleCreate}
        loading={createFolder.isPending}
      />

      {editFolder && (
        <FolderFormDialog
          open={!!editFolder}
          onOpenChange={(v) => !v && setEditFolder(null)}
          folder={editFolder}
          onSave={handleEdit}
          loading={updateFolder.isPending}
        />
      )}

      {permFolder && (
        <PermissionsDialog
          folderId={permFolder.id}
          folderName={permFolder.name}
          open={!!permFolder}
          onOpenChange={(v) => !v && setPermFolder(null)}
        />
      )}
    </div>
  );
}
