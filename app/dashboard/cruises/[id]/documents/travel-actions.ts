"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../../../lib/supabase/server";

export async function updateTravelDocument(
  cruiseId: string,
  travelItemId: string,
  formData: FormData
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const costValue = readString(formData, "cost");

  const cost = costValue
    ? Number.parseFloat(costValue)
    : null;

  const { error } = await supabase
    .from("travel_items")
    .update({
      title: readNullableString(formData, "title"),
      company_name: readNullableString(
        formData,
        "company_name"
      ),
      confirmation_number: readNullableString(
        formData,
        "confirmation_number"
      ),
      reference_number: readNullableString(
        formData,
        "reference_number"
      ),
      start_date: readNullableString(
        formData,
        "start_date"
      ),
      end_date: readNullableString(
        formData,
        "end_date"
      ),
      address: readNullableString(
        formData,
        "address"
      ),
      cost:
        cost !== null && Number.isFinite(cost)
          ? cost
          : null,
      currency:
        readNullableString(formData, "currency") ||
        "USD",
      notes: readNullableString(formData, "notes"),
      status:
        readNullableString(formData, "status") ||
        "confirmed",
    })
    .eq("id", travelItemId)
    .eq("cruise_id", cruiseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(
      `The travel document could not be updated: ${error.message}`
    );
  }

  revalidatePath(
    `/dashboard/cruises/${cruiseId}`
  );

  revalidatePath(
    `/dashboard/cruises/${cruiseId}/travel`
  );

  revalidatePath(
    `/dashboard/cruises/${cruiseId}/documents`
  );
}

export async function deleteTravelDocument(
  cruiseId: string,
  travelItemId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const { data: travelItem, error: readError } =
    await supabase
      .from("travel_items")
      .select("id, file_path")
      .eq("id", travelItemId)
      .eq("cruise_id", cruiseId)
      .eq("user_id", user.id)
      .single();

  if (readError || !travelItem) {
    throw new Error(
      "The travel document could not be found."
    );
  }

  const { error: deleteError } = await supabase
    .from("travel_items")
    .delete()
    .eq("id", travelItemId)
    .eq("cruise_id", cruiseId)
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(
      `The travel document could not be deleted: ${deleteError.message}`
    );
  }

  if (travelItem.file_path) {
    const { error: storageError } =
      await supabase.storage
        .from("travel-documents")
        .remove([travelItem.file_path]);

    if (storageError) {
      console.error(
        "Travel record deleted, but the stored file could not be removed:",
        storageError
      );
    }
  }

  revalidatePath(
    `/dashboard/cruises/${cruiseId}`
  );

  revalidatePath(
    `/dashboard/cruises/${cruiseId}/travel`
  );

  revalidatePath(
    `/dashboard/cruises/${cruiseId}/documents`
  );
}

function readString(
  formData: FormData,
  fieldName: string
) {
  const value = formData.get(fieldName);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function readNullableString(
  formData: FormData,
  fieldName: string
) {
  const value = readString(formData, fieldName);

  return value || null;
}