import { addDoc, collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, updateDoc, type CollectionReference, type DocumentReference, type Query } from "@/lib/firebase/fs";
import type { Timestamp } from "@/lib/firebase/fs";

import { getDb } from "@/lib/firebase/client";

export interface RecipeDoc {
  title: string;
  ingredients: string[];
  steps: string[];
  addedBy: string;
  createdAt: Timestamp | null;
}

export const recipesCol = () => collection(getDb(), "recipes") as CollectionReference<RecipeDoc>;
export const recipeRef = (id: string) => doc(getDb(), "recipes", id) as DocumentReference<RecipeDoc>;
export const recipesQuery = (): Query<RecipeDoc> => query(recipesCol(), orderBy("createdAt", "desc"), limit(50));

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40);

export async function addRecipe(addedBy: string, title: string, ingredients: string, steps: string): Promise<string> {
  const ref = await addDoc(recipesCol(), { title: title.trim().slice(0, 80), ingredients: lines(ingredients), steps: lines(steps), addedBy, createdAt: serverTimestamp() });
  return ref.id;
}
export const editRecipe = (id: string, title: string, ingredients: string, steps: string) => updateDoc(recipeRef(id), { title: title.trim().slice(0, 80), ingredients: lines(ingredients), steps: lines(steps) });
export const deleteRecipe = (id: string) => deleteDoc(recipeRef(id));
