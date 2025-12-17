"use client";

import { JSX, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";import { toast } from "sonner";import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  ChevronsUpDown,
  Check,
  Globe,
  GitBranch,
  Shield,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserSession {
  id: string;
  isAdmin: boolean;
  divisionIds: number[];
  departmentIds: number[];
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

interface FormData {
  name: string;
  description: string;
  markdown: string;
  baseVisibility: "public" | "division" | "department" | null;
  divisionId: number | null;
  departmentId: number | null;
  includeCustomRoles: boolean;
  selectedRoles: number[];
}

interface TemplateFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate: Template | null;
  formData: FormData;
  setFormData: (data: FormData | ((prev: FormData) => FormData)) => void;
  divisions: Division[];
  departments: Department[];
  roles: Role[];
  saving: boolean;
  onSave: () => Promise<void>;
  onToggleRole: (roleId: number) => void;
  getVisibilityBadge: (
    visibility: string,
    divisionName?: string | null,
    departmentName?: string | null
  ) => JSX.Element;
  session?: UserSession | null;
}

export function TemplateFormDialog({
  isOpen,
  onOpenChange,
  editingTemplate,
  formData,
  setFormData,
  divisions,
  departments,
  roles,
  saving,
  onSave,
  onToggleRole,
  getVisibilityBadge,
  session,
}: TemplateFormDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  // Filter divisions based on user access
  const availableDivisions =
    session && !session.isAdmin
      ? divisions.filter((d) => session.divisionIds.includes(d.id))
      : divisions;

  // Filter departments based on user access
  const availableDepartments =
    session && !session.isAdmin
      ? departments.filter((d) => session.departmentIds.includes(d.id))
      : departments;

  const departmentsForDivision = availableDepartments;

  // Handle file upload and conversion to markdown
  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/convert-to-markdown", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to convert file");
      }

      const data = await response.json();
      setFormData({
        ...formData,
        markdown: data.markdown,
      });
      toast.success("File converted to markdown successfully");
    } catch (error) {
      console.error("File upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to convert file"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? "Edit Template" : "Create New Template"}
          </DialogTitle>
          <DialogDescription>
            {editingTemplate
              ? "Update your template"
              : "Create a new template for document generation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="MoM Sprint Planning"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Template for minutes of meeting sprint planning"
            />
          </div>

          {/* Visibility Section */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Visibility</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    <strong>Public:</strong> Everyone can access
                    <br />
                    <strong>Division:</strong> Only specific division
                    <br />
                    <strong>Department:</strong> Only specific department
                    <br />
                    <strong>Custom Roles:</strong> Additional access based on
                    role
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Base Access Level */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Base Access Level
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={
                    formData.baseVisibility === "public"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className={cn(
                    "flex-1",
                    formData.baseVisibility === "public" &&
                      "bg-emerald-600 hover:bg-emerald-700"
                  )}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      baseVisibility:
                        formData.baseVisibility === "public" ? null : "public",
                      divisionId: null,
                      departmentId: null,
                    })
                  }
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Public
                </Button>
                <Button
                  type="button"
                  variant={
                    formData.baseVisibility === "division"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className={cn(
                    "flex-1",
                    formData.baseVisibility === "division" &&
                      "bg-blue-600 hover:bg-blue-700"
                  )}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      baseVisibility:
                        formData.baseVisibility === "division" ? null : "division",
                      departmentId: null,
                    })
                  }
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Division
                </Button>
                <Button
                  type="button"
                  variant={
                    formData.baseVisibility === "department"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className={cn(
                    "flex-1",
                    formData.baseVisibility === "department" &&
                      "bg-cyan-600 hover:bg-cyan-700"
                  )}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      baseVisibility:
                        formData.baseVisibility === "department"
                          ? null
                          : "department",
                    })
                  }
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Department
                </Button>
              </div>
            </div>

            {/* Division Selector */}
            {formData.baseVisibility === "division" && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Select Division
                </Label>
                <Popover open={divisionOpen} onOpenChange={setDivisionOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={divisionOpen}
                      className="w-full justify-between bg-card"
                    >
                      {formData.divisionId
                        ? availableDivisions.find(
                            (d) => d.id === formData.divisionId
                          )?.name
                        : "Select division..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command filter={(value, search) => {
                      if (search === "") return 1
                      if (value.toLowerCase().includes(search.toLowerCase())) return 1
                      return 0
                    }}>
                      <CommandInput placeholder="Search division..." />
                      <CommandList>
                        <CommandEmpty>No divisions found.</CommandEmpty>
                        {availableDivisions.map((division) => (
                          <CommandItem
                            key={division.id}
                            value={division.name}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                divisionId: division.id,
                                departmentId: null,
                              });
                              setDivisionOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.divisionId === division.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {division.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Department Selector */}
            {formData.baseVisibility === "department" && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Select Department
                  </Label>
                  <Popover open={departmentOpen} onOpenChange={setDepartmentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={departmentOpen}
                        className="w-full justify-between"
                      >
                        {formData.departmentId
                          ? availableDepartments.find(
                              (d) => d.id === formData.departmentId
                            )?.name
                          : "Select department..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command filter={(value, search) => {
                        if (search === "") return 1
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1
                        return 0
                      }}>
                        <CommandInput placeholder="Search department..." />
                        <CommandList>
                          <CommandEmpty>No departments found.</CommandEmpty>
                          {availableDepartments.map((dept) => (
                            <CommandItem
                              key={dept.id}
                              value={dept.name}
                              onSelect={() => {
                                setFormData({
                                  ...formData,
                                  departmentId: dept.id,
                                });
                                setDepartmentOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.departmentId === dept.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {dept.name}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

            {/* Custom Roles */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="customRoles"
                  checked={formData.includeCustomRoles}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      includeCustomRoles: !!checked,
                      selectedRoles: checked ? formData.selectedRoles : [],
                    });
                  }}
                />
                <Label
                  htmlFor="customRoles"
                  className="text-sm font-normal cursor-pointer"
                >
                  Additional access for specific roles
                  <span className="text-xs text-muted-foreground ml-1">
                    (adds selected roles
                    {formData.baseVisibility &&
                    formData.baseVisibility !== "public"
                      ? " to base access"
                      : ""}
                    )
                  </span>
                </Label>
              </div>

              {formData.includeCustomRoles && (
                <div className="space-y-2 pt-1 ml-6">
                  <Popover open={rolesOpen} onOpenChange={setRolesOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={rolesOpen}
                        className="w-full justify-between bg-card h-9 text-sm"
                      >
                        {formData.selectedRoles.length > 0
                          ? `${formData.selectedRoles.length} role(s) selected`
                          : "Select roles..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                      <Command filter={(value, search) => {
                        if (search === "") return 1
                        if (value.toLowerCase().includes(search.toLowerCase())) return 1
                        return 0
                      }}>
                        <CommandInput placeholder="Search roles..." />
                        <CommandList className="max-h-36">
                          <CommandEmpty>No roles found.</CommandEmpty>
                          {roles
                            .filter((r) => r.name !== "admin")
                            .map((role) => (
                              <CommandItem
                                key={role.id}
                                value={role.name}
                                onSelect={() => onToggleRole(role.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.selectedRoles.includes(role.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="capitalize">
                                  {role.name}
                                </span>
                              </CommandItem>
                            ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {formData.selectedRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.selectedRoles.map((roleId) => {
                        const role = roles.find((r) => r.id === roleId);
                        return role ? (
                          <Badge
                            key={roleId}
                            variant="outline"
                            className="gap-1 capitalize text-xs py-0.5"
                          >
                            <Shield className="h-3 w-3" />
                            {role.name}
                            <button
                              onClick={() => onToggleRole(roleId)}
                              className="ml-0.5 rounded-full outline-none hover:bg-black/20"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="pt-2 border-t">
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">
                  Preview:
                </Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Show base visibility if set (division/department takes priority) */}
                  {(formData.baseVisibility === "division" ||
                    formData.baseVisibility === "department") && (
                    getVisibilityBadge(
                      formData.baseVisibility,
                      divisions.find((d) => d.id === formData.divisionId)?.name,
                      departmentsForDivision.find(
                        (d) => d.id === formData.departmentId
                      )?.name
                    )
                  )}
                  {/* Show public if that's the only base visibility and no custom roles */}
                  {formData.baseVisibility === "public" &&
                    (!formData.includeCustomRoles ||
                      formData.selectedRoles.length === 0) &&
                    getVisibilityBadge("public")}
                  {/* Show custom badge only if custom roles are selected WITHOUT base visibility */}
                  {formData.includeCustomRoles &&
                    formData.selectedRoles.length > 0 &&
                    !formData.baseVisibility &&
                    getVisibilityBadge("custom")}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Template Content *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".docx,.pdf";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await handleFileUpload(file);
                    }
                  };
                  input.click();
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  "Upload Document (DOCX/PDF)"
                )}
              </Button>
            </div>
            {formData.markdown && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Preview / Edit Markdown
                </Label>
                <Textarea
                  value={formData.markdown}
                  onChange={(e) =>
                    setFormData({ ...formData, markdown: e.target.value })
                  }
                  placeholder="# Document Title..."
                  rows={15}
                  className="font-mono text-sm max-h-96"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload a DOCX or PDF file to automatically convert to markdown, or
              edit the markdown directly below
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
