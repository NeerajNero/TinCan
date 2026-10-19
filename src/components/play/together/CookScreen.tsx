"use client";

import { Check, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SubHeader } from "@/components/memories/SubHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { usePair } from "@/hooks/usePair";
import { useStartInvite } from "@/hooks/useStartInvite";
import { cn } from "@/lib/cn";
import { addRecipe, deleteRecipe, editRecipe, recipeRef, recipesQuery, type RecipeDoc } from "@/lib/db/recipes";
import { resetCook, setCookStep, subscribeCook } from "@/lib/db/together";
import { onSnapshot, type QueryDocumentSnapshot } from "@/lib/firebase/fs";
import { recordTogetherEvent } from "@/lib/garden";

interface Recipe extends RecipeDoc {
  id: string;
}
const mapDoc = (d: QueryDocumentSnapshot<RecipeDoc>): Recipe => ({ id: d.id, ...d.data() });

export function CookList() {
  const { uid, me, friend } = usePair();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState<Recipe | "new" | null>(null);
  const nameOf = (id: string) => (id === uid ? me.nickname : (friend?.nickname ?? "Friend"));
  useEffect(() => {
    const unsub = onSnapshot(recipesQuery(), (snap) => {
      setRecipes(snap.docs.map(mapDoc));
      setReady(true);
    });
    return () => unsub();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        help="cook"
        emoji="🍳"
        title="Cook-along"
        back="/play"
        screenName="Cook-along"
        action={
          form === null ? (
            <Button onClick={() => setForm("new")} className="px-4 py-2 text-sm">
              Add recipe
            </Button>
          ) : null
        }
      />
      {form !== null && <RecipeForm key={form === "new" ? "new" : form.id} uid={uid} recipe={form === "new" ? null : form} onDone={() => setForm(null)} />}
      {!ready && <ListSkeleton />}
      {ready && recipes.length === 0 && form === null && <Card className="py-8 text-center text-muted">No recipes yet. Add one you both want to try.</Card>}
      {recipes.map((r) => (
        <Card key={r.id} className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => router.push(`/play/cook/${r.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="text-2xl" aria-hidden>
              🥘
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r.title}</span>
              <span className="block text-xs text-muted">
                {r.ingredients.length} ingredients · {r.steps.length} steps · by {nameOf(r.addedBy)}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => setForm(r)} aria-label="Edit recipe" className="tap grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2">
            <Pencil size={16} />
          </button>
        </Card>
      ))}
    </div>
  );
}

function RecipeForm({ uid, recipe, onDone }: { uid: string; recipe: Recipe | null; onDone: () => void }) {
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join("\n") ?? "");
  const [steps, setSteps] = useState(recipe?.steps.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const canSave = title.trim() && steps.trim() && !busy;
  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      if (recipe) await editRecipe(recipe.id, title, ingredients, steps);
      else await addRecipe(uid, title, ingredients, steps);
      onDone();
    } finally {
      setBusy(false);
    }
  }
  const area = "w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px] focus:border-[var(--accent)] focus:outline-none";
  return (
    <Card className="flex flex-col gap-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Dish name" aria-label="Title" autoFocus />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc-ing">Ingredients, one per line</Label>
        <textarea id="rc-ing" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} className={area} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc-steps">Steps, one per line</Label>
        <textarea id="rc-steps" value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} className={area} />
      </div>
      <div className="flex justify-between gap-2">
        {recipe ? (
          <Button variant="ghost" onClick={() => void deleteRecipe(recipe.id).then(onDone)} className="text-red-500">
            <Trash2 size={16} /> Delete
          </Button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave} className="px-5">
            {busy ? "Saving…" : "Save"}
          </Button>
        </span>
      </div>
    </Card>
  );
}

export function CookDetail({ id }: { id: string }) {
  const { uid, friend, friendUid } = usePair();
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [by, setBy] = useState<string | null>(null);
  const startInvite = useStartInvite();
  const [invited, setInvited] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    const a = onSnapshot(recipeRef(id), (snap) => setRecipe(snap.exists() ? { id, ...snap.data() } : null));
    const b = subscribeCook(id, (c, who) => {
      setChecked(c);
      setBy(who);
    });
    return () => {
      a();
      b();
    };
  }, [id]);

  const done = recipe ? recipe.steps.filter((_, i) => checked[i]).length : 0;
  const all = Boolean(recipe && recipe.steps.length > 0 && done === recipe.steps.length);
  useEffect(() => {
    if (all && !completed.current) {
      completed.current = true;
      recordTogetherEvent("cook", uid);
    }
    if (!all) completed.current = false;
  }, [all, uid]);

  if (recipe === undefined) return <Card className="py-8 text-center text-muted">Loading…</Card>;
  if (recipe === null) return <Card className="py-8 text-center text-muted">This recipe is gone.</Card>;

  const invite = { activity: "cook" as const, route: `/play/cook/${id}`, label: `cooking ${recipe.title}`.slice(0, 80) };
  async function startTogether() {
    if (!friendUid || invited) return;
    const res = await startInvite(invite.activity, invite.route, invite.label);
    if (res.ok) setInvited(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader help="cook" emoji="🍳" title={recipe.title} back="/play/cook" screenName={`cooking ${recipe.title}`} invite={invite} />
      <div className="flex gap-2">
        <Button onClick={() => void startTogether()} disabled={!friendUid || invited} className="flex-1">
          {invited ? `Invited ${friend?.nickname ?? ""} ✓` : "Start cooking together"}
        </Button>
        <Button variant="ghost" onClick={() => void resetCook(id)}>
          Reset
        </Button>
      </div>
      {recipe.ingredients.length > 0 && (
        <Card className="flex flex-col gap-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Ingredients</h2>
          <ul className="list-disc pl-5 text-sm">
            {recipe.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Steps</h2>
          <span className="text-xs text-muted">
            {done}/{recipe.steps.length}
            {by && ` · last by ${by === uid ? "you" : (friend?.nickname ?? "friend")}`}
          </span>
        </div>
        {recipe.steps.map((step, i) => {
          const on = Boolean(checked[i]);
          return (
            <button key={i} type="button" onClick={() => void setCookStep(id, i, !on, uid)} aria-pressed={on} className={cn("tap flex items-start gap-3 rounded-2xl px-3 py-2.5 text-left", on ? "bg-emerald-400/15" : "bg-surface-2")}>
              <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2", on ? "border-emerald-500 bg-emerald-500 text-white" : "border-border")}>{on && <Check size={14} />}</span>
              <span className={cn("text-[15px]", on && "line-through opacity-70")}>
                <span className="mr-1 text-xs font-bold text-muted">{i + 1}.</span>
                {step}
              </span>
            </button>
          );
        })}
        {all && <p className="pt-1 text-center font-heading font-semibold">All done — bon appétit 🎉</p>}
      </Card>
    </div>
  );
}
