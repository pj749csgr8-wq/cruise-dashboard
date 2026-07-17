"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";

export async function updateCruise(
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

  const cruiseLine = String(
    formData.get("cruise_line") || ""
  ).trim();

  const sailingFrom = String(
    formData.get("sailing_from") || ""
  ).trim();

  const shipName = String(
    formData.get("ship_name") || ""
  ).trim();

  const departureDate = String(
    formData.get("departure_date") || ""
  );

  const bookingNumber = String(
    formData.get("booking_number") || ""
  ).trim();

  const totalCost = String(
    formData.get("total_cost") || ""
  );

  const durationNights = String(
    formData.get("duration_nights") || ""
  );

  const notes = String(
    formData.get("notes") || ""
  ).trim();

  const drinkPackage =
    formData.get("drink_package") === "yes";

  const wifiPackage =
    formData.get("wifi_package") === "yes";

  const paidOff =
    formData.get("paid_off") === "yes";

  if (!cruiseLine || !shipName || !departureDate) {
    throw new Error(
      "Cruise line, ship and departure date are required."
    );
  }

  const { error } = await supabase
    .from("cruises")
    .update({
      cruise_line: cruiseLine,
      sailing_from: sailingFrom || null,
      ship_name: shipName,
      departure_date: departureDate,
      booking_number: bookingNumber || null,
      total_cost: totalCost ? Number(totalCost) : null,
      duration_nights: durationNights
        ? Number(durationNights)
        : null,
      notes: notes || null,
      drink_package: drinkPackage,
      wifi_package: wifiPackage,
      paid_off: paidOff,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cruiseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(
      `Unable to update cruise: ${error.message}`
    );
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/cruises/${cruiseId}`);

  redirect(`/dashboard/cruises/${cruiseId}`);
}

export async function deleteCruise(cruiseId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("cruises")
    .delete()
    .eq("id", cruiseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(
      `Unable to delete cruise: ${error.message}`
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}