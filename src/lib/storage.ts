import { supabase } from "@/integrations/supabase/client";

const BUCKET = "assets";
/** ~10 anos: a URL assinada funciona como link estável para a interface. */
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function extensionOf(name: string, fallback = "png") {
  const ext = name.split(".").pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : fallback;
}

async function signed(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (error) throw error;
  return data.signedUrl;
}

/** Pasta privada do usuário: nenhum arquivo é gravado em área compartilhada. */
async function userFolder(folder: string) {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sessão expirada.");
  return `users/${uid}/${folder}`;
}

/** Envia um arquivo do usuário (foto de perfil, logotipo) e devolve a URL. */
export async function uploadAsset(file: File, folder: string) {
  const path = `${await userFolder(folder)}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return signed(path);
}

/**
 * Cache de escudo: baixa a imagem da origem e guarda no armazenamento.
 * Se a origem bloquear o download, o sistema segue usando a URL remota.
 */
export async function cacheRemoteImage(url: string, folder: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao baixar imagem (${response.status}).`);
  const blob = await response.blob();
  const path = `${await userFolder(folder)}/${crypto.randomUUID()}.${extensionOf(url, "png")}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/png" });
  if (error) throw error;
  return signed(path);
}

/** Envia um arquivo pessoal (foto/logotipo) isolado na pasta do usuário. */
export async function uploadUserAsset(blob: Blob, folder: string, ext = "webp") {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sessão expirada.");
  const path = `users/${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/webp" });
  if (error) throw error;
  return signed(path);
}
