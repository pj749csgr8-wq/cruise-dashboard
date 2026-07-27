import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

type TravelAnalysis = {
  item_type:
    | "flight"
    | "hotel"
    | "taxi"
    | "transfer"
    | "excursion"
    | "train"
    | "rental_car"
    | "restaurant"
    | "cruise_document"
    | "other";

  title: string | null;
  company_name: string | null;
  confirmation_number: string | null;
  reference_number: string | null;

  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;

  departure_location: string | null;
  arrival_location: string | null;
  address: string | null;

  flight_number: string | null;
  terminal: string | null;
  gate: string | null;

  cost: number | null;
  currency: string | null;

  notes: string | null;
  ai_summary: string;
  ai_confidence: number;
};

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const formData = await request.formData();

    const uploadedFile = formData.get("file");
    const cruiseIdValue = formData.get("cruiseId");
    const analysisValue = formData.get("analysis");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          error: "The original travel document is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const cruiseId =
      typeof cruiseIdValue === "string"
        ? cruiseIdValue.trim()
        : "";

    if (!cruiseId) {
      return NextResponse.json(
        {
          error: "A cruise must be selected.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof analysisValue !== "string" ||
      !analysisValue.trim()
    ) {
      return NextResponse.json(
        {
          error: "The AI analysis is missing.",
        },
        {
          status: 400,
        }
      );
    }

    if (uploadedFile.size === 0) {
      return NextResponse.json(
        {
          error: "The selected file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (uploadedFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "The file must be 10 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_FILE_TYPES.has(uploadedFile.type)) {
      return NextResponse.json(
        {
          error: "Use a JPG, PNG, WebP or PDF file.",
        },
        {
          status: 400,
        }
      );
    }

    let analysis: TravelAnalysis;

    try {
      analysis = JSON.parse(analysisValue) as TravelAnalysis;
    } catch {
      return NextResponse.json(
        {
          error: "The AI analysis could not be read.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: cruise, error: cruiseError } =
      await supabase
        .from("cruises")
        .select("id")
        .eq("id", cruiseId)
        .eq("user_id", user.id)
        .single();

    if (cruiseError || !cruise) {
      return NextResponse.json(
        {
          error:
            "That cruise was not found or does not belong to your account.",
        },
        {
          status: 404,
        }
      );
    }

    const safeFileName = sanitizeFileName(
      uploadedFile.name
    );

    uploadedPath = [
      user.id,
      cruiseId,
      `${randomUUID()}-${safeFileName}`,
    ].join("/");

    const fileBytes = await uploadedFile.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("travel-documents")
      .upload(uploadedPath, fileBytes, {
        contentType: uploadedFile.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `The file could not be uploaded: ${uploadError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    const { data: savedItem, error: insertError } =
      await supabase
        .from("travel_items")
        .insert({
          user_id: user.id,
          cruise_id: cruiseId,

          item_type: analysis.item_type,
          title:
            analysis.title ||
            defaultTitle(analysis.item_type),

          company_name: analysis.company_name,
          confirmation_number:
            analysis.confirmation_number,
          reference_number: analysis.reference_number,

          start_date: analysis.start_date,
          start_time: normalizeTime(analysis.start_time),
          end_date: analysis.end_date,
          end_time: normalizeTime(analysis.end_time),

          departure_location:
            analysis.departure_location,
          arrival_location:
            analysis.arrival_location,
          address: analysis.address,

          flight_number: analysis.flight_number,
          terminal: analysis.terminal,
          gate: analysis.gate,

          cost: analysis.cost,
          currency: analysis.currency || "USD",

          notes: analysis.notes,

          file_name: uploadedFile.name,
          file_path: uploadedPath,
          mime_type: uploadedFile.type,

          ai_confidence: analysis.ai_confidence,
          ai_summary: analysis.ai_summary,

          extracted_data: analysis,
          status: "confirmed",
        })
        .select("id, item_type, title")
        .single();

    if (insertError || !savedItem) {
      await supabase.storage
        .from("travel-documents")
        .remove([uploadedPath]);

      uploadedPath = null;

      return NextResponse.json(
        {
          error: `The travel item could not be saved: ${
            insertError?.message || "Unknown database error"
          }`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      item: savedItem,
    });
  } catch (error) {
    console.error("Saving travel item failed:", error);

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "travel-document";
}

function normalizeTime(time: string | null) {
  if (!time) {
    return null;
  }

  const match = time.match(
    /^([01]\d|2[0-3]):([0-5]\d)/
  );

  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}:00`;
}

function defaultTitle(itemType: string) {
  return itemType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}