"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";

export async function addExcursion(
  cruiseId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const excursionName = String(
    formData.get("excursion_name") || ""
  ).trim();

  const portName = String(
    formData.get("port_name") || ""
  ).trim();

  const excursionDate = String(
    formData.get("excursion_date") || ""
  );

  const provider = String(
    formData.get("provider") || ""
  ).trim();

  const confirmationNumber = String(
    formData.get("confirmation_number") || ""
  ).trim();

  const cost = String(formData.get("cost") || "");

  const status = String(
    formData.get("status") || "Booked"
  ).trim();

  const notes = String(
    formData.get("notes") || ""
  ).trim();

  if (!excursionName) {
    throw new Error("Excursion name is required.");
  }

  const { data: cruise } = await supabase
    .from("cruises")
    .select("id")
    .eq("id", cruiseId)
    .single();

  if (!cruise) {
    throw new Error("Cruise not found.");
  }

  const { error } = await supabase.from("excursions").insert({
    user_id: user.id,
    cruise_id: cruiseId,
    excursion_name: excursionName,
    port_name: portName || null,
    excursion_date: excursionDate || null,
    provider: provider || null,
    confirmation_number: confirmationNumber || null,
    cost: cost ? Number(cost) : null,
    status,
    notes: notes || null,
  });

  if (error) {
    throw new Error(`Unable to save excursion: ${error.message}`);
  }

  revalidatePath(`/dashboard/cruises/${cruiseId}/excursions`);
  redirect(`/dashboard/cruises/${cruiseId}/excursions`);
}

export async function deleteExcursion(
  cruiseId: string,
  excursionId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("excursions")
    .delete()
    .eq("id", excursionId)
    .eq("cruise_id", cruiseId);

  if (error) {
    throw new Error(`Unable to delete excursion: ${error.message}`);
  }

  revalidatePath(`/dashboard/cruises/${cruiseId}/excursions`);
}