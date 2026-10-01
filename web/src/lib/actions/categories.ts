'use server';

import { z } from 'zod';
import {
  CATEGORY_NAME_MAX_LENGTH,
  validateCategoryInput,
  validateRestoreCategory,
} from '@/lib/core/logic/categories';
import { canManageCategories } from '@/lib/core/logic/permissions';
import { mapCategory, type PotCategoryRow } from '@/lib/mappers';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';
import {
  assertActiveMember,
  getCurrentMember,
  requireUser,
  revalidatePotPaths,
} from '@/lib/actions/_helpers';

/**
 * Pot category management. Owner/admin only — checked here for a clear message
 * and again by the database RPCs, which derive authorization from the
 * category's own pot (a client-supplied pot_id is never trusted on its own).
 */

const categoryFields = z.object({
  name: z.string().max(CATEGORY_NAME_MAX_LENGTH * 4),
  icon: z.string(),
  color: z.string(),
});

type Supabase = Awaited<ReturnType<typeof requireUser>>['supabase'];

async function loadCategories(supabase: Supabase, potId: string) {
  const { data, error } = await supabase.from('pot_categories').select('*').eq('pot_id', potId);
  if (error) throw error;
  return ((data ?? []) as PotCategoryRow[]).map(mapCategory);
}

async function authorize(potId: string) {
  const auth = await requireUser();
  if (!auth.user) return { error: auth.error } as const;
  const me = assertActiveMember(await getCurrentMember(auth.supabase, potId, auth.user.id));
  if (!canManageCategories(me)) return { error: 'Only a pot admin can manage categories' } as const;
  return { supabase: auth.supabase } as const;
}

export async function createCategory(
  potId: string,
  input: z.infer<typeof categoryFields>,
): Promise<ActionResult<{ categoryId: string }>> {
  try {
    const parsed = categoryFields.parse(input);
    const auth = await authorize(potId);
    if ('error' in auth) return actionFail(auth.error);

    const check = validateCategoryInput(parsed, await loadCategories(auth.supabase, potId));
    if (!check.valid) return actionFail(check.error);

    const { data, error } = await auth.supabase.rpc('create_pot_category', {
      p_pot_id: potId,
      p_name: check.value.name,
      p_icon: check.value.icon,
      p_color: check.value.color,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk({ categoryId: (data as PotCategoryRow).id });
  } catch (err) {
    return actionFail(err);
  }
}

export async function updateCategory(
  potId: string,
  categoryId: string,
  input: z.infer<typeof categoryFields>,
): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(categoryId);
    const parsed = categoryFields.parse(input);
    const auth = await authorize(potId);
    if ('error' in auth) return actionFail(auth.error);

    const categories = await loadCategories(auth.supabase, potId);
    if (!categories.some((c) => c.id === id)) return actionFail('Category not found');
    const check = validateCategoryInput(parsed, categories, id);
    if (!check.valid) return actionFail(check.error);

    const { error } = await auth.supabase.rpc('update_pot_category', {
      p_category_id: id,
      p_name: check.value.name,
      p_icon: check.value.icon,
      p_color: check.value.color,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

/** Archive (`active = false`) or restore (`true`). Categories are never deleted. */
export async function setCategoryActive(potId: string, categoryId: string, active: boolean): Promise<ActionResult> {
  try {
    const id = z.string().uuid().parse(categoryId);
    const auth = await authorize(potId);
    if ('error' in auth) return actionFail(auth.error);

    const categories = await loadCategories(auth.supabase, potId);
    if (!categories.some((c) => c.id === id)) return actionFail('Category not found');
    if (active) {
      const check = validateRestoreCategory(categories);
      if (!check.valid) return actionFail(check.error ?? 'Could not restore this category');
    }

    const { error } = await auth.supabase.rpc('set_pot_category_active', {
      p_category_id: id,
      p_active: active,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

/** Persist a new order for the given category ids (the active ones, in display order). */
export async function reorderCategories(potId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const ids = z.array(z.string().uuid()).max(200).parse(orderedIds);
    const auth = await authorize(potId);
    if ('error' in auth) return actionFail(auth.error);

    const { error } = await auth.supabase.rpc('reorder_pot_categories', {
      p_pot_id: potId,
      p_category_ids: ids,
    });
    if (error) return actionFail(error);

    revalidatePotPaths(potId);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}
