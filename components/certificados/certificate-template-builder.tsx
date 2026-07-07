"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, Image as ImageIcon, QrCode, Type, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CERTIFICATE_FIELD_LABELS,
  CERTIFICATE_FONT_FAMILIES,
  CERTIFICATE_FONT_LABELS,
  SAMPLE_FIELD_VALUES,
  type CertificateElement,
  type CertificateFieldKey,
  type CertificateFontFamily,
  type CertificateLayout,
} from "@/lib/certificate-template";
import {
  saveCertificateLayoutAction,
  resetCertificateLayoutAction,
  uploadTemplateBackgroundAction,
  uploadTemplateImageAction,
} from "@/app/admin/certificados/plantilla/actions";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function newId() {
  return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function elementLabel(element: CertificateElement): string {
  if (element.type === "text") return CERTIFICATE_FIELD_LABELS[element.fieldKey];
  if (element.type === "static") return element.text || "Texto fijo";
  if (element.type === "qr") return "Código QR";
  if (element.kind === "logo") return "Logo institucional";
  if (element.kind === "firma") return "Firma";
  return "Imagen";
}

export function CertificateTemplateBuilder({
  initialLayout,
  backgroundImageUrl,
  logoUrl,
  signatureUrl,
}: {
  initialLayout: CertificateLayout;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<CertificateElement[]>(initialLayout.elements);
  const [background, setBackground] = useState(backgroundImageUrl);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const draggingRef = useRef<{ id: string; offsetXPct: number; offsetYPct: number } | null>(null);

  const selected = elements.find((el) => el.id === selectedId) ?? null;

  function updateSelected(patch: Partial<CertificateElement>) {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? ({ ...el, ...patch } as CertificateElement) : el)));
  }

  function removeSelected() {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  function addField(fieldKey: CertificateFieldKey) {
    const el: CertificateElement = {
      id: newId(),
      type: "text",
      fieldKey,
      x: 35,
      y: 46,
      fontSize: 12,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "center",
      widthPct: 40,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  function addStaticText() {
    const el: CertificateElement = {
      id: newId(),
      type: "static",
      text: "Texto fijo",
      x: 35,
      y: 46,
      fontSize: 12,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "center",
      widthPct: 40,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  function addQr() {
    const el: CertificateElement = { id: newId(), type: "qr", x: 82, y: 78, sizePct: 12 };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  function addImageSlot(kind: "logo" | "firma") {
    const el: CertificateElement = {
      id: newId(),
      type: "image",
      kind,
      src: null,
      x: 42,
      y: 6,
      widthPct: 14,
      heightPct: 12,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  async function handleUploadCustomImage(file: File) {
    const formData = new FormData();
    formData.set("imagen", file);
    const result = await uploadTemplateImageAction({ error: null }, formData);
    if (result.error || !result.url) {
      setMessage(result.error ?? "No se pudo subir la imagen.");
      return;
    }
    const el: CertificateElement = {
      id: newId(),
      type: "image",
      kind: "custom",
      src: result.url,
      x: 40,
      y: 40,
      widthPct: 20,
      heightPct: 20,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  async function handleUploadBackground(file: File) {
    const formData = new FormData();
    formData.set("fondo", file);
    const result = await uploadTemplateBackgroundAction({ error: null }, formData);
    if (result.error || !result.url) {
      setMessage(result.error ?? "No se pudo subir el fondo.");
      return;
    }
    setBackground(result.url);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await saveCertificateLayoutAction({ elements });
    setSaving(false);
    setMessage(result.error ?? "Plantilla guardada correctamente.");
  }

  async function handleReset() {
    if (!confirm("¿Restablecer la plantilla al diseño original? Se perderán los cambios guardados.")) return;
    await resetCertificateLayoutAction();
    router.refresh();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, el: CertificateElement) {
    e.stopPropagation();
    setSelectedId(el.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;
    draggingRef.current = { id: el.id, offsetXPct: pointerXPct - el.x, offsetYPct: pointerYPct - el.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = draggingRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;
    const nextX = clamp(pointerXPct - drag.offsetXPct, 0, 98);
    const nextY = clamp(pointerYPct - drag.offsetYPct, 0, 98);
    setElements((prev) => prev.map((el) => (el.id === drag.id ? { ...el, x: nextX, y: nextY } : el)));
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_260px]">
      {/* Paleta de campos */}
      <div className="surface space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos del usuario</p>
        <div className="space-y-1.5">
          {(Object.entries(CERTIFICATE_FIELD_LABELS) as [CertificateFieldKey, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => addField(key)}
              className="w-full rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted"
            >
              {`{{${label}}}`}
            </button>
          ))}
        </div>

        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elementos</p>
        <div className="space-y-1.5">
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={addStaticText}>
            <Type className="h-3.5 w-3.5" />
            Texto fijo
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={addQr}>
            <QrCode className="h-3.5 w-3.5" />
            Código QR
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={() => addImageSlot("logo")}>
            <ImageIcon className="h-3.5 w-3.5" />
            Logo institucional
          </Button>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-1.5" onClick={() => addImageSlot("firma")}>
            <ImageIcon className="h-3.5 w-3.5" />
            Firma
          </Button>
          <label className="flex w-full cursor-pointer items-center justify-start gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
            <Upload className="h-3.5 w-3.5" />
            Añadir imagen
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadCustomImage(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fondo de la plantilla</p>
        <label className="flex w-full cursor-pointer items-center justify-start gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
          <Upload className="h-3.5 w-3.5" />
          Subir imagen de fondo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadBackground(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Lienzo */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Arrastra cada elemento para ubicarlo. La vista previa usa datos de ejemplo.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Guardar plantilla"}
            </Button>
          </div>
        </div>

        {message && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}

        <div
          ref={canvasRef}
          className="relative w-full select-none overflow-hidden rounded-lg border-2 border-navy bg-white shadow-sm"
          style={{ aspectRatio: "841.89 / 595.28" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {background && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={background} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}

          {elements.map((el) => {
            const isSelected = el.id === selectedId;
            const commonStyle = {
              left: `${el.x}%`,
              top: `${el.y}%`,
            };

            if (el.type === "text" || el.type === "static") {
              const text = el.type === "static" ? el.text : SAMPLE_FIELD_VALUES[el.fieldKey];
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => handlePointerDown(e, el)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={cn(
                    "absolute cursor-grab whitespace-pre-wrap break-words px-1 py-0.5 active:cursor-grabbing",
                    isSelected && "outline outline-2 outline-primary"
                  )}
                  style={{
                    ...commonStyle,
                    width: `${el.widthPct}%`,
                    fontSize: `${el.fontSize}pt`,
                    fontFamily: el.fontFamily.startsWith("Times") ? "serif" : el.fontFamily.startsWith("Courier") ? "monospace" : "sans-serif",
                    fontWeight: el.fontFamily.includes("Bold") ? 700 : 400,
                    fontStyle: el.fontFamily.includes("Oblique") || el.fontFamily.includes("Italic") ? "italic" : "normal",
                    color: el.color,
                    textAlign: el.align,
                  }}
                >
                  {text || "(vacío)"}
                </div>
              );
            }

            if (el.type === "qr") {
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => handlePointerDown(e, el)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className={cn(
                    "absolute flex cursor-grab items-center justify-center border border-dashed border-muted-foreground bg-muted/50 text-[8px] text-muted-foreground active:cursor-grabbing",
                    isSelected && "outline outline-2 outline-primary"
                  )}
                  style={{ ...commonStyle, width: `${el.sizePct}%`, aspectRatio: "1 / 1" }}
                >
                  QR
                </div>
              );
            }

            // image
            const previewSrc = el.kind === "logo" ? logoUrl : el.kind === "firma" ? signatureUrl : el.src;
            return (
              <div
                key={el.id}
                onPointerDown={(e) => handlePointerDown(e, el)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                  "absolute flex cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing",
                  isSelected && "outline outline-2 outline-primary"
                )}
                style={{ ...commonStyle, width: `${el.widthPct}%`, height: `${el.heightPct}%` }}
              >
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center border border-dashed border-muted-foreground bg-muted/50 text-[8px] text-muted-foreground">
                    {elementLabel(el)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel de propiedades */}
      <div className="surface space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Propiedades</p>
        {!selected && <p className="text-sm text-muted-foreground">Selecciona un elemento del lienzo para editarlo.</p>}

        {selected && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{elementLabel(selected)}</p>

            {selected.type === "static" && (
              <div className="space-y-1.5">
                <Label htmlFor="static-text">Texto</Label>
                <Input
                  id="static-text"
                  value={selected.text}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                />
              </div>
            )}

            {(selected.type === "text" || selected.type === "static") && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="font-size">Tamaño de fuente (pt)</Label>
                  <Input
                    id="font-size"
                    type="number"
                    min={6}
                    max={72}
                    value={selected.fontSize}
                    onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="font-family">Fuente</Label>
                  <select
                    id="font-family"
                    value={selected.fontFamily}
                    onChange={(e) => updateSelected({ fontFamily: e.target.value as CertificateFontFamily })}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CERTIFICATE_FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {CERTIFICATE_FONT_LABELS[font]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="color">Color</Label>
                  <input
                    id="color"
                    type="color"
                    value={selected.color}
                    onChange={(e) => updateSelected({ color: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Alineación</Label>
                  <div className="flex gap-1.5">
                    {(["left", "center", "right"] as const).map((align) => (
                      <Button
                        key={align}
                        type="button"
                        size="sm"
                        variant={selected.align === align ? "default" : "outline"}
                        onClick={() => updateSelected({ align })}
                      >
                        {align === "left" ? "Izq." : align === "center" ? "Centro" : "Der."}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="width-pct">Ancho de la caja (%)</Label>
                  <Input
                    id="width-pct"
                    type="number"
                    min={5}
                    max={100}
                    value={selected.widthPct}
                    onChange={(e) => updateSelected({ widthPct: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            {selected.type === "image" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="width-pct-img">Ancho (%)</Label>
                  <Input
                    id="width-pct-img"
                    type="number"
                    min={2}
                    max={100}
                    value={selected.widthPct}
                    onChange={(e) => updateSelected({ widthPct: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="height-pct-img">Alto (%)</Label>
                  <Input
                    id="height-pct-img"
                    type="number"
                    min={2}
                    max={100}
                    value={selected.heightPct}
                    onChange={(e) => updateSelected({ heightPct: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            {selected.type === "qr" && (
              <div className="space-y-1.5">
                <Label htmlFor="size-pct-qr">Tamaño (%)</Label>
                <Input
                  id="size-pct-qr"
                  type="number"
                  min={5}
                  max={40}
                  value={selected.sizePct}
                  onChange={(e) => updateSelected({ sizePct: Number(e.target.value) })}
                />
              </div>
            )}

            <Button type="button" variant="destructive" size="sm" className="w-full gap-1.5" onClick={removeSelected}>
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar elemento
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
