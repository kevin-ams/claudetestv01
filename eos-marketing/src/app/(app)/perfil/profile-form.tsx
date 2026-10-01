"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ColorSwatchPicker, Input, Label, parseColor } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { AppCheckbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { UserAvatar } from "@/components/user-avatar";
import { isHexColor, THEME_PRESETS } from "@/lib/theme";
import {
  changePasswordAction,
  removeAvatarAction,
  saveProfileAction,
  uploadAvatarAction,
  type ProfileResult,
} from "./actions";

const SIDE = 512;

/** Recorta al centro en cuadrado y reduce a 512 px (las fotos de celular pesan mucho). */
async function squareImage(file: File): Promise<File | string> {
  if (/\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    return "Las fotos HEIC de iPhone no se pueden mostrar en el navegador. Guárdala como JPG o PNG.";
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return "No se pudo leer la imagen. Usa PNG, JPG o WEBP.";
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIDE, side);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) return "No se pudo procesar la imagen.";
  return new File([blob], "perfil.webp", { type: "image/webp" });
}

function Result({ result }: { result: ProfileResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`text-sm ${result.ok ? "text-green" : "text-red"}`}>
      {result.ok ? "✓ " : "✕ "}
      {result.message}
    </p>
  );
}

export function ProfileForm({
  profile,
  pronouns,
}: {
  profile: {
    name: string;
    email: string;
    pronoun: string;
    color: string;
    use_color_theme: boolean;
    avatarSrc: string | null;
  };
  pronouns: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [pronoun, setPronoun] = useState(profile.pronoun);
  const [color, setColor] = useState(profile.color);
  const [useTheme, setUseTheme] = useState(profile.use_color_theme);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [photoResult, setPhotoResult] = useState<ProfileResult | null>(null);
  const [pwResult, setPwResult] = useState<ProfileResult | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setPhotoResult(null);
    const prepared = await squareImage(file);
    if (typeof prepared === "string") {
      setPhotoResult({ ok: false, message: prepared });
      setUploading(false);
      return;
    }
    const fd = new FormData();
    fd.set("image", prepared);
    const res = await uploadAvatarAction(fd).catch(() => ({ ok: false, message: "No se pudo subir la foto." }));
    setPhotoResult(res);
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Header>
          <Card.Title>Foto</Card.Title>
        </Card.Header>
        <Card.Content className="flex-row flex-wrap items-center gap-4">
          <UserAvatar name={name} src={profile.avatarSrc} color={color || undefined} size="lg" className="size-20 rounded-full text-xl" />
          <div className="flex flex-wrap gap-2">
            <label className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer`}>
              {uploading ? "Subiendo…" : profile.avatarSrc ? "Cambiar foto" : "Subir foto"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                aria-label="Foto de perfil"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            {profile.avatarSrc && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red"
                isDisabled={pending}
                onPress={() =>
                  startTransition(async () => {
                    setPhotoResult(await removeAvatarAction());
                    router.refresh();
                  })
                }
              >
                Quitar foto
              </Button>
            )}
          </div>
          <Result result={photoResult} />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Datos</Card.Title>
          <Card.Description>Correo: {profile.email} (lo cambia un administrador en Ajustes › Equipo).</Card.Description>
        </Card.Header>
        <Card.Content className="gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="perfil-nombre">Nombre</Label>
            <Input id="perfil-nombre" value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Pronombre</Label>
            <Segmented
              aria-label="Pronombre"
              options={pronouns.map((p) => ({ id: p.key || "ninguno", label: p.label }))}
              value={pronoun || "ninguno"}
              onChange={(v) => setPronoun(v === "ninguno" ? "" : v)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Mi color</Label>
            <div className="flex flex-wrap items-center gap-3">
              <ColorSwatchPicker
                aria-label="Colores sugeridos"
                value={isHexColor(color) ? parseColor(color) : undefined}
                onChange={(c) => setColor(c.toString("hex").toLowerCase())}
              >
                {THEME_PRESETS.map((p) => (
                  <ColorSwatchPicker.Item key={p.color} color={p.color} aria-label={p.name}>
                    <ColorSwatchPicker.Swatch />
                    <ColorSwatchPicker.Indicator />
                  </ColorSwatchPicker.Item>
                ))}
              </ColorSwatchPicker>
              <input
                type="color"
                aria-label="Color personalizado"
                value={isHexColor(color) ? color : "#234c6a"}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              />
              {color && (
                <Button size="sm" variant="ghost" onPress={() => setColor("")}>
                  Sin color
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">Se usa en tu avatar y para identificarte en la plataforma.</p>
            <AppCheckbox checked={useTheme && Boolean(color)} disabled={!color} onChange={(e) => setUseTheme(e.target.checked)} className="text-sm">
              Usar mi color como color de la plataforma (solo lo veo yo)
            </AppCheckbox>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              isPending={pending}
              onPress={() =>
                startTransition(async () => {
                  const res = await saveProfileAction({ name, pronoun, color, useColorTheme: useTheme });
                  setResult(res);
                  if (res.ok) router.refresh();
                })
              }
            >
              Guardar perfil
            </Button>
            <Result result={result} />
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Contraseña</Card.Title>
        </Card.Header>
        <Card.Content className="gap-2">
          <Input type="password" aria-label="Contraseña actual" placeholder="Contraseña actual" value={current} onChange={(e) => setCurrent(e.target.value)} className="max-w-sm" />
          <Input type="password" aria-label="Nueva contraseña" placeholder="Nueva contraseña (mínimo 8)" value={next} onChange={(e) => setNext(e.target.value)} className="max-w-sm" />
          <Button
            variant="outline"
            className="self-start"
            isDisabled={!current || next.length < 8}
            onPress={() =>
              startTransition(async () => {
                const res = await changePasswordAction(current, next);
                setPwResult(res);
                if (res.ok) {
                  setCurrent("");
                  setNext("");
                }
              })
            }
          >
            Cambiar contraseña
          </Button>
          <Result result={pwResult} />
        </Card.Content>
      </Card>
    </div>
  );
}
