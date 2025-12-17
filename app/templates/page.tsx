"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Search,
  Globe,
  Lock,
  Building2,
  GitBranch,
  Shield,
} from "lucide-react";
import { LayoutShell } from "@/components/layout-shell";
import { TemplateFormDialog } from "@/components/template-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  description: string | null;
  markdown: string;
  visibility: string;
  divisionId: number | null;
  departmentId: number | null;
  roleIds: number[];
  isSystem: boolean;
  isOwner: boolean;
  canModify: boolean;
  ownerName: string | null;
  createdAt: string;
}

interface Division {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  divisionId: number;
}

interface Role {
  id: number;
  name: string;
  isSystem?: boolean;
}

// Helper function for visibility badge with colors matching mpm-it-portal
function getVisibilityBadge(
  visibility: string,
  divisionName?: string | null,
  departmentName?: string | null
) {
  switch (visibility) {
    case "public":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        >
          <Globe className="h-3 w-3" />
          Public
        </Badge>
      );
    case "custom":
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20"
        >
          <Shield className="h-3 w-3" />
          Restricted
        </Badge>
      );
    case "department":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-cyan-500/10 text-cyan-600 border-cyan-500/20 cursor-help"
            >
              <GitBranch className="h-3 w-3" />
              Department
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{departmentName || "Department only"}</TooltipContent>
        </Tooltip>
      );
    case "division":
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20 cursor-help"
            >
              <Building2 className="h-3 w-3" />
              Division
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{divisionName || "Division only"}</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="text-xs gap-1 bg-gray-500/10 text-gray-600 border-gray-500/20"
        >
          <Lock className="h-3 w-3" />
          Private
        </Badge>
      );
  }
}

export default function TemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "mine">("all");

  // Reference data
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    markdown: "",
    baseVisibility: "public" as "public" | "division" | "department" | null,
    divisionId: null as number | null,
    departmentId: null as number | null,
    includeCustomRoles: false,
    selectedRoles: [] as number[],
  });

  // Fetch templates
  async function fetchTemplates() {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        data.forEach((template: Template) => {
          template.visibility = template.visibility == "custom" ? (template.divisionId ? "division" : template.departmentId ? "department" : "custom") : template.visibility;
        })
        setTemplates(data);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  // Fetch reference data (divisions, departments, roles from portal)
  async function fetchReferenceData() {
    try {
      const [divisionsRes, departmentsRes, rolesRes] = await Promise.all([
        fetch("/api/portal/divisions"),
        fetch("/api/portal/departments"),
        fetch("/api/portal/roles"),
      ]);

      if (divisionsRes.ok) {
        const data = await divisionsRes.json();
        setDivisions(data);
      }
      if (departmentsRes.ok) {
        const data = await departmentsRes.json();
        setDepartments(data);
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        // Filter out system roles like admin
        setRoles(data.filter((r: Role) => r.name !== "admin"));
      }
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchTemplates();
      fetchReferenceData();
    }
  }, [session]);

  // Get departments for selected division
  const departmentsForDivision = formData.divisionId
    ? departments.filter((d) => d.divisionId === formData.divisionId)
    : [];

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesOwner = ownerFilter === "all" || template.isOwner;
    return matchesSearch && matchesOwner;
  });

  // Open create dialog
  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      markdown: getDefaultMarkdown(),
      baseVisibility: "public",
      divisionId: null,
      departmentId: null,
      includeCustomRoles: false,
      selectedRoles: [],
    });
    setIsDialogOpen(true);
  }

  // Open edit dialog
  function openEditDialog(template: Template) {
    // Determine base visibility from template
    const hasRoles = template.roleIds && template.roleIds.length > 0;
    let baseVis: "public" | "division" | "department" | null = null;

    if (template.visibility === "custom") {
      // For custom visibility, check if there's a base access level (division/department)
      if (template.departmentId) baseVis = "department";
      else if (template.divisionId) baseVis = "division";
      // If custom has only roles, baseVis stays null
    } else {
      baseVis = template.visibility as "public" | "division" | "department";
    }

    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      markdown: template.markdown,
      baseVisibility: baseVis,
      divisionId: template.divisionId,
      departmentId: template.departmentId,
      includeCustomRoles: hasRoles,
      selectedRoles: template.roleIds || [],
    });
    setIsDialogOpen(true);
  }

  // Toggle role selection
  function toggleRole(roleId: number) {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  }

  // Calculate visibility from form data
  // If custom roles are selected, visibility is always "custom"
  // Otherwise, use base visibility (public, division, or department)
  function getEffectiveVisibility(): string {
    if (formData.includeCustomRoles && formData.selectedRoles.length > 0) {
      return "custom";
    }
    return formData.baseVisibility || "public";
  }

  // Save template
  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    if (!formData.markdown.trim()) {
      toast.error("Template content is required");
      return;
    }

    // Validate visibility settings
    if (formData.baseVisibility === "division" && !formData.divisionId) {
      toast.error("Select a division for Division visibility");
      return;
    }
    if (formData.baseVisibility === "department" && !formData.departmentId) {
      toast.error("Select a department for Department visibility");
      return;
    }

    // Validate that either base visibility or custom roles are selected
    if (
      formData.baseVisibility === null &&
      (!formData.includeCustomRoles || formData.selectedRoles.length === 0)
    ) {
      toast.error(
        "Select a base access level or add custom roles"
      );
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";

      const visibility = getEffectiveVisibility();

      // Prepare the payload
      // For custom visibility with base access level (division/department + roles)
      // Keep the division/department info
      // For custom visibility with only roles, set division/department to null
      const payload: any = {
        name: formData.name,
        description: formData.description,
        markdown: formData.markdown,
        visibility,
        divisionId: null,
        departmentId: null,
        roleIds: formData.includeCustomRoles ? formData.selectedRoles : [],
      };

      // If base visibility is division or department, include that info
      if (
        formData.baseVisibility === "division" ||
        formData.baseVisibility === "department"
      ) {
        payload.divisionId = formData.divisionId;
        if (formData.baseVisibility === "department") {
          payload.departmentId = formData.departmentId;
        }
      }

      const res = await fetch(url, {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success(
        editingTemplate
          ? "Template updated successfully"
          : "Template created successfully"
      );
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save template"
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete template
  async function handleDelete(templateId: string) {
    setDeleteTemplateId(null);
    setDeleting(templateId);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
        toast.success("Template deleted successfully");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    } finally {
      setDeleting(null);
    }
  }

  // Get default markdown for new template
  function getDefaultMarkdown(): string {
    return `# Template Document

## Section 1
[konten]

## Section 2
[konten]`;
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    router.push("/");
    return null;
  }

  return (
    <TooltipProvider>
      <LayoutShell
        title="Template Manager"
        description="Manage templates for document generation"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-md p-1">
              <Button
                variant={ownerFilter === "mine" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOwnerFilter("mine")}
                className="text-xs"
              >
                My Templates
              </Button>
              <Button
                variant={ownerFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setOwnerFilter("all")}
                className="text-xs"
              >
                All
              </Button>
            </div>
          </div>

          {/* Template Grid */}
          {filteredTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No templates found</p>
                <Button variant="link" onClick={openCreateDialog}>
                  Create your first template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg truncate">
                          {template.name}
                        </CardTitle>
                        {template.isSystem && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            System
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {template.description || "No description"}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getVisibilityBadge(
                          template.visibility,
                          divisions.find((d) => d.id === template.divisionId)
                            ?.name,
                          departments.find(
                            (d) => d.id === template.departmentId
                          )?.name
                        )}
                        {template.ownerName && (
                          <span className="text-xs text-muted-foreground">
                            by {template.ownerName}
                          </span>
                        )}
                      </div>
                      {template.canModify && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(template)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {!template.isSystem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTemplateId(template.id)}
                              disabled={deleting === template.id}
                            >
                              {deleting === template.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {/* Template Form Dialog */}
        <TemplateFormDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingTemplate={editingTemplate}
          formData={formData}
          setFormData={setFormData}
          divisions={divisions}
          departments={departments}
          roles={roles}
          saving={saving}
          onSave={handleSave}
          onToggleRole={toggleRole}
          getVisibilityBadge={getVisibilityBadge}
          session={session ? {
            id: session.user?.id || "",
            isAdmin: (session.user as any)?.isAdmin || false,
            divisionIds: (session.user as any)?.divisionIds || [],
            departmentIds: (session.user as any)?.departmentIds || [],
          } : null}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteTemplateId}
          onOpenChange={(open) => !open && setDeleteTemplateId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this template? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteTemplateId && handleDelete(deleteTemplateId)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </LayoutShell>
    </TooltipProvider>
  );
}
