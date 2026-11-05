// Необязательная облачная синхронизация через Supabase.
// Пользователь создаёт бесплатный проект на supabase.com, вставляет URL и anon-ключ
// в настройках, создаёт таблицу (SQL в DEPLOY.md) — и может переносить данные
// между телефоном и компьютером.
//
// Стратегия v1: снимок целиком (push/pull). Революции не нужно — данные одного человека.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig, SyncSnapshot } from "./types";

let cached: { client: SupabaseClient; url: string; key: string } | null = null;

function getClient(cfg: SupabaseConfig): SupabaseClient {
  if (!cfg.url || !cfg.anonKey) throw new Error("Supabase не настроен");
  if (cached && cached.url === cfg.url && cached.key === cfg.anonKey) return cached.client;
  const client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, storageKey: "gonorar-sb-auth" },
  });
  cached = { client, url: cfg.url, key: cfg.anonKey };
  return client;
}

export async function sbSignUp(cfg: SupabaseConfig, email: string, password: string) {
  const sb = getClient(cfg);
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function sbSignIn(cfg: SupabaseConfig, email: string, password: string) {
  const sb = getClient(cfg);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sbSignOut(cfg: SupabaseConfig) {
  const sb = getClient(cfg);
  await sb.auth.signOut();
}

export async function sbGetUser(cfg: SupabaseConfig) {
  const sb = getClient(cfg);
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

const TABLE = "gonorar_backups";

/** Отправить снимок в облако (перезаписывает предыдущий). */
export async function sbPush(cfg: SupabaseConfig, snapshot: SyncSnapshot): Promise<void> {
  const sb = getClient(cfg);
  const { data: sess } = await sb.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) throw new Error("Нужно войти в облако");
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: userId, payload: snapshot, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Загрузить снимок из облака. Возвращает null, если в облаке пусто. */
export async function sbPull(cfg: SupabaseConfig): Promise<SyncSnapshot | null> {
  const sb = getClient(cfg);
  const { data: sess } = await sb.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) throw new Error("Нужно войти в облако");
  const { data, error } = await sb
    .from(TABLE)
    .select("payload, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.payload as SyncSnapshot;
}

/** Дата последнего облачного бэкапа (для отображения статуса). */
export async function sbPullMeta(cfg: SupabaseConfig): Promise<string | null> {
  const sb = getClient(cfg);
  const { data: sess } = await sb.auth.getSession();
  const userId = sess.session?.user?.id;
  if (!userId) return null;
  const { data } = await sb.from(TABLE).select("updated_at").eq("user_id", userId).maybeSingle();
  return data?.updated_at ?? null;
}
