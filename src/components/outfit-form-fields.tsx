"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Camera, ImagePlus, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OutfitTypeSelect } from "@/components/outfit-type-select";
import { CameraCaptureModal } from "@/components/camera-capture-modal";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface OutfitAddOn {
  id: string;
  name: string;
  /** String in form state — converted to number on submit */
  price: string;
  notes: string;
}

export interface OutfitFormValue {
  name: string;
  type: string;
  occasion: string;
  price: string;
  maggamRequired: boolean;
  designerId: string;
  masterId: string;
  addOns: OutfitAddOn[];
  fabricImages: File[];
  /** Existing saved fabric refs shown in edit mode */
  existingFabricRefs?: { id: string; url: string; filename?: string }[];
}

export function emptyAddOn(): OutfitAddOn {
  return { id: crypto.randomUUID(), name: "", price: "", notes: "" };
}

export function emptyOutfitFormValue(): OutfitFormValue {
  return {
    name: "",
    type: "",
    occasion: "",
    price: "",
    maggamRequired: false,
    designerId: "",
    masterId: "",
    addOns: [],
    fabricImages: [],
    existingFabricRefs: [],
  };
}

// ─── Staff option type ────────────────────────────────────────────────────────

export interface StaffOption {
  id: string;
  name: string;
  active?: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OutfitFormFieldsProps {
  value: OutfitFormValue;
  onChange: (value: OutfitFormValue) => void;

  /** Show designer / master selects */
  showStaffAssignment?: boolean;
  designers?: StaffOption[];
  masters?: StaffOption[];

  /** Lock core fields (name/type/price) when outfit is in production */
  coreFieldsLocked?: boolean;
  /** Hides delete affordance etc — used in "new outfit" context */
  isEditMode?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutfitFormFields({
  value,
  onChange,
  showStaffAssignment = false,
  designers = [],
  masters = [],
  coreFieldsLocked = false,
  isEditMode = false,
}: OutfitFormFieldsProps) {
  const [cameraOpen, setCameraOpen] = useState(false);

  // Stable blob URL management
  const blobUrlsRef = useRef<string[]>([]);
  const fabricPreviewUrls = useMemo(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const urls = value.fabricImages.map((f) => URL.createObjectURL(f));
    blobUrlsRef.current = urls;
    return urls;
  }, [value.fabricImages]);
  useEffect(
    () => () => blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function set<K extends keyof OutfitFormValue>(
    field: K,
    val: OutfitFormValue[K],
  ) {
    onChange({ ...value, [field]: val });
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(f.type),
    );
    onChange({ ...value, fabricImages: [...value.fabricImages, ...valid] });
  }

  function removeImage(idx: number) {
    onChange({
      ...value,
      fabricImages: value.fabricImages.filter((_, i) => i !== idx),
    });
  }

  function updateAddOn(idx: number, field: keyof OutfitAddOn, val: string) {
    const updated = value.addOns.map((a, i) =>
      i === idx ? { ...a, [field]: val } : a,
    );
    set("addOns", updated);
  }

  function removeAddOn(idx: number) {
    set(
      "addOns",
      value.addOns.filter((_, i) => i !== idx),
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Lock notice */}
      {coreFieldsLocked && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
          This outfit is in production — name, type, price and other core fields
          are locked. You can still edit add-ons below.
        </p>
      )}

      {/* Core fields grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Item Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g., Heavy Silk Blouse"
            disabled={coreFieldsLocked}
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            Type <span className="text-destructive">*</span>
          </Label>
          <OutfitTypeSelect
            value={value.type}
            onValueChange={(val) => set("type", val)}
            disabled={coreFieldsLocked}
          />
        </div>

        {/* Occasion */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Occasion</Label>
          <Input
            value={value.occasion}
            onChange={(e) => set("occasion", e.target.value)}
            placeholder="e.g. Wedding Reception"
            disabled={coreFieldsLocked}
          />
        </div>

        {/* Price */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Estimated Price (₹)</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">
              ₹
            </span>
            <Input
              type="number"
              className="pl-7"
              value={value.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="0.00"
              disabled={coreFieldsLocked}
            />
          </div>
        </div>

        {/* Designer */}
        {showStaffAssignment && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned Designer</Label>
            <Select
              value={value.designerId || "none"}
              onValueChange={(val) =>
                set("designerId", val === "none" ? "" : val)
              }
              disabled={coreFieldsLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign later..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Assign later…</SelectItem>
                {designers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {d.active === false && " (Inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Master */}
        {showStaffAssignment && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Assigned Master</Label>
            <Select
              value={value.masterId || "none"}
              onValueChange={(val) =>
                set("masterId", val === "none" ? "" : val)
              }
              disabled={coreFieldsLocked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign later..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Assign later…</SelectItem>
                {masters.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                    {m.active === false && " (Inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Separator />

      {/* Maggam checkbox */}
      <div className="flex items-center space-x-2 pt-1">
        <Checkbox
          id="maggam"
          checked={value.maggamRequired}
          onCheckedChange={(checked) =>
            set("maggamRequired", Boolean(checked))
          }
          disabled={coreFieldsLocked}
        />
        <label
          htmlFor="maggam"
          className="text-xs font-medium leading-none cursor-pointer flex items-center gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Maggam / Hand Embroidery Work Required
        </label>
      </div>

      <Separator />

      {/* Add-ons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-primary" />
            Add-ons (Sourced Items)
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => set("addOns", [...value.addOns, emptyAddOn()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Item
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Items sourced externally (e.g., dupatta) with separate pricing
        </p>
        {value.addOns.length > 0 && (
          <div className="space-y-2">
            {value.addOns.map((addOn, idx) => (
              <div
                key={addOn.id}
                className="flex gap-2 items-start p-2 border rounded-md"
              >
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Item name"
                    value={addOn.name}
                    onChange={(e) => updateAddOn(idx, "name", e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    value={addOn.price}
                    onChange={(e) => updateAddOn(idx, "price", e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Notes (optional)"
                    value={addOn.notes}
                    onChange={(e) => updateAddOn(idx, "notes", e.target.value)}
                    className="h-8 text-xs col-span-2"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAddOn(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Fabric images */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <ImagePlus className="h-3.5 w-3.5 text-primary" />
          Customer Material Images
        </Label>
        <p className="text-xs text-muted-foreground">
          {isEditMode
            ? "Add new photos or view existing material images."
            : "Upload photos of the customer's fabric material (optional)."}
        </p>

        {/* Existing refs in edit mode */}
        {isEditMode && (value.existingFabricRefs || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(value.existingFabricRefs || []).map((ref) => (
              <div
                key={ref.id}
                className="relative w-16 h-16 rounded-md overflow-hidden border"
              >
                <img
                  src={ref.url}
                  alt="Fabric"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* New image previews */}
        {value.fabricImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {value.fabricImages.map((file, imgIdx) => (
              <div
                key={imgIdx}
                className="relative group w-16 h-16 rounded-md overflow-hidden border"
              >
                <img
                  src={fabricPreviewUrls[imgIdx]}
                  alt={`Fabric ${imgIdx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(imgIdx)}
                  className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload + camera */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="outfit-fabric-upload"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md cursor-pointer hover:bg-muted transition-colors"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {value.fabricImages.length > 0 ||
            (value.existingFabricRefs || []).length > 0
              ? "Add More"
              : "Upload Material Photos"}
          </label>
          <input
            id="outfit-fabric-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              addImages(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Take Photo
          </Button>
        </div>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          onChange({ ...value, fabricImages: [...value.fabricImages, file] });
          setCameraOpen(false);
        }}
      />
    </div>
  );
}
