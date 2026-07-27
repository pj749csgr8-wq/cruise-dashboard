import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 10;

const STANDARD_MONTHLY_LIMIT = 10;
const HEAVY_MONTHLY_LIMIT = 50;

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AiPlanName = "standard" | "heavy";

type UserAiPlan = {
  plan_name: AiPlanName;
  monthly_ai_limit: number;
};

type TravelDocumentAnalysis = {
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

const travelDocumentSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    item_type: {
      type: "string",
      enum: [
        "flight",
        "hotel",
        "taxi",
        "transfer",
        "excursion",
        "train",
        "rental_car",
        "restaurant",
        "cruise_document",
        "other",
      ],
    },

    title: {
      type: ["string", "null"],
    },

    company_name: {
      type: ["string", "null"],
    },

    confirmation_number: {
      type: ["string", "null"],
    },

    reference_number: {
      type: ["string", "null"],
    },

    start_date: {
      type: ["string", "null"],
    },

    start_time: {
      type: ["string", "null"],
    },

    end_date: {
      type: ["string", "null"],
    },

    end_time: {
      type: ["string", "null"],
    },

    departure_location: {
      type: ["string", "null"],
    },

    arrival_location: {
      type: ["string", "null"],
    },

    address: {
      type: ["string", "null"],
    },

    flight_number: {
      type: ["string", "null"],
    },

    terminal: {
      type: ["string", "null"],
    },

    gate: {
      type: ["string", "null"],
    },

    cost: {
      type: ["number", "null"],
    },

    currency: {
      type: ["string", "null"],
    },

    notes: {
      type: ["string", "null"],
    },

    ai_summary: {
      type: "string",
    },

    ai_confidence: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },
  },

  required: [
    "item_type",
    "title",
    "company_name",
    "confirmation_number",
    "reference_number",
    "start_date",
    "start_time",
    "end_date",
    "end_time",
    "departure_location",
    "arrival_location",
    "address",
    "flight_number",
    "terminal",
    "gate",
    "cost",
    "currency",
    "notes",
    "ai_summary",
    "ai_confidence",
  ],
} as const;

export async function POST(request: Request) {
  let usageReservationId: string | null = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "The OpenAI API key is not configured on the server.",
        },
        {
          status: 500,
        }
      );
    }

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

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Choose a travel document to analyze.",
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
          error: "AI files must be 5 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_FILE_TYPES.has(uploadedFile.type)) {
      return NextResponse.json(
        {
          error:
            "Use a JPG, PNG, WebP or PDF file.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: cruise, error: cruiseError } =
      await supabase
        .from("cruises")
        .select(
          "id, cruise_line, ship_name, departure_date"
        )
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

    const fileBytes = Buffer.from(
      await uploadedFile.arrayBuffer()
    );

    if (uploadedFile.type === "application/pdf") {
      const pageCountResult =
        await getPdfPageCount(fileBytes);

      if (!pageCountResult.success) {
        return NextResponse.json(
          {
            error: pageCountResult.error,
          },
          {
            status: 400,
          }
        );
      }

      if (pageCountResult.pageCount > MAX_PDF_PAGES) {
        return NextResponse.json(
          {
            error:
              `AI PDF uploads are limited to ${MAX_PDF_PAGES} pages. This PDF contains ${pageCountResult.pageCount} pages.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const plan = await getUserPlan(
      supabase,
      user.id
    );

    const monthStart = getCurrentMonthStart();
    const nextMonthStart = getNextMonthStart();

    const {
      count: currentUsage,
      error: usageCountError,
    } = await supabase
      .from("ai_usage")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .in("status", [
        "processing",
        "successful",
      ])
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStart);

    if (usageCountError) {
      console.error(
        "AI usage could not be counted:",
        usageCountError
      );

      return NextResponse.json(
        {
          error:
            "Your AI allowance could not be checked.",
        },
        {
          status: 500,
        }
      );
    }

    const usedBeforeRequest = currentUsage ?? 0;

    if (
      usedBeforeRequest >=
      plan.monthly_ai_limit
    ) {
      return NextResponse.json(
        {
          error:
            `You have used all ${plan.monthly_ai_limit} AI document analyses available on your ${formatPlanName(plan.plan_name)} plan this month.`,

          code: "MONTHLY_AI_LIMIT_REACHED",

          usage: {
            plan: plan.plan_name,
            used: usedBeforeRequest,
            limit: plan.monthly_ai_limit,
            remaining: 0,
            resets_at: nextMonthStart,
          },
        },
        {
          status: 429,
        }
      );
    }

    const {
      data: reservation,
      error: reservationError,
    } = await supabase
      .from("ai_usage")
      .insert({
        user_id: user.id,
        cruise_id: cruise.id,
        request_type: "travel_document",
        status: "processing",
        file_name: uploadedFile.name,
        file_size_bytes: uploadedFile.size,
        mime_type: uploadedFile.type,
      })
      .select("id")
      .single();

    if (reservationError || !reservation) {
      console.error(
        "AI usage reservation failed:",
        reservationError
      );

      return NextResponse.json(
        {
          error:
            "The AI analysis could not be started.",
        },
        {
          status: 500,
        }
      );
    }

    usageReservationId = reservation.id;

    const {
      count: usageAfterReservation,
      error: postReservationCountError,
    } = await supabase
      .from("ai_usage")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .in("status", [
        "processing",
        "successful",
      ])
      .gte("created_at", monthStart)
      .lt("created_at", nextMonthStart);

    if (postReservationCountError) {
      await removeUsageReservation(
        supabase,
        usageReservationId as string,
        user.id
      );

      usageReservationId = null;

      return NextResponse.json(
        {
          error:
            "Your AI allowance could not be confirmed.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      (usageAfterReservation ?? 0) >
      plan.monthly_ai_limit
    ) {
      await removeUsageReservation(
        supabase,
        usageReservationId as string,
        user.id
      );

      usageReservationId = null;

      return NextResponse.json(
        {
          error:
            `You have used all ${plan.monthly_ai_limit} AI document analyses available this month.`,

          code: "MONTHLY_AI_LIMIT_REACHED",

          usage: {
            plan: plan.plan_name,
            used: plan.monthly_ai_limit,
            limit: plan.monthly_ai_limit,
            remaining: 0,
            resets_at: nextMonthStart,
          },
        },
        {
          status: 429,
        }
      );
    }

    const base64File =
      fileBytes.toString("base64");

    const fileDataUrl =
      `data:${uploadedFile.type};base64,${base64File}`;

    const instructions = `
Analyze this travel-related document for a cruise travel organizer.

The selected cruise is:
Cruise line: ${cruise.cruise_line}
Ship: ${cruise.ship_name}
Cruise departure date: ${cruise.departure_date}

Classify the document as one of:
flight, hotel, taxi, transfer, excursion, train,
rental_car, restaurant, cruise_document or other.

Extract only information that is actually visible in the document.

Important rules:
- Do not invent missing information.
- Use null when information is missing or uncertain.
- Dates must use YYYY-MM-DD.
- Times must use HH:MM in 24-hour format.
- Cost must be a number without a currency symbol.
- Currency must use a three-letter code such as USD.
- Confidence must be a number from 0 through 100.
- The summary must briefly describe the document.
- Put useful information that does not fit another field in notes.
- A booking date is not necessarily the travel date.
- For flights, distinguish departure and arrival airports.
- For hotels, use check-in as the start date and check-out as the end date.
- For taxis or transfers, use pickup and destination as the locations.
- For excursions, include the port, meeting location and provider when visible.
    `.trim();

    let response;

    if (uploadedFile.type === "application/pdf") {
      response = await openai.responses.create({
        model: "gpt-5-mini",
        store: false,

        input: [
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: uploadedFile.name,
                file_data: fileDataUrl,
              },
              {
                type: "input_text",
                text: instructions,
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "travel_document_analysis",
            strict: true,
            schema: travelDocumentSchema,
          },
        },
      });
    } else {
      response = await openai.responses.create({
        model: "gpt-5-mini",
        store: false,

        input: [
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: fileDataUrl,
                detail: "high",
              },
              {
                type: "input_text",
                text: instructions,
              },
            ],
          },
        ],

        text: {
          format: {
            type: "json_schema",
            name: "travel_document_analysis",
            strict: true,
            schema: travelDocumentSchema,
          },
        },
      });
    }

    if (!response.output_text) {
      await removeUsageReservation(
        supabase,
        usageReservationId as string,
        user.id
      );

      usageReservationId = null;

      return NextResponse.json(
        {
          error:
            "The AI did not return usable travel details.",
        },
        {
          status: 502,
        }
      );
    }

    let analysis: TravelDocumentAnalysis;

    try {
      analysis = JSON.parse(
        response.output_text
      ) as TravelDocumentAnalysis;
    } catch {
      await removeUsageReservation(
        supabase,
        usageReservationId as string,
        user.id
      );

      usageReservationId = null;

      return NextResponse.json(
        {
          error:
            "The AI response could not be read.",
        },
        {
          status: 502,
        }
      );
    }

    const { error: completeUsageError } =
      await supabase
        .from("ai_usage")
        .update({
          status: "successful",
          completed_at: new Date().toISOString(),
        })
        .eq(
          "id",
          usageReservationId as string
        )
        .eq("user_id", user.id);

    if (completeUsageError) {
      console.error(
        "AI usage could not be marked successful:",
        completeUsageError
      );
    }

    const usedAfterRequest = Math.min(
      usedBeforeRequest + 1,
      plan.monthly_ai_limit
    );

    const remaining = Math.max(
      plan.monthly_ai_limit - usedAfterRequest,
      0
    );

    usageReservationId = null;

    return NextResponse.json({
      success: true,

      cruise: {
        id: cruise.id,
        cruise_line: cruise.cruise_line,
        ship_name: cruise.ship_name,
        departure_date: cruise.departure_date,
      },

      file: {
        name: uploadedFile.name,
        type: uploadedFile.type,
        size: uploadedFile.size,
      },

      usage: {
        plan: plan.plan_name,
        used: usedAfterRequest,
        limit: plan.monthly_ai_limit,
        remaining,
        resets_at: nextMonthStart,
      },

      analysis,
    });
  } catch (error) {
    console.error(
      "Travel document analysis failed:",
      error
    );

    if (usageReservationId) {
      try {
        const supabase = await createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await removeUsageReservation(
            supabase,
            usageReservationId,
            user.id
          );
        }
      } catch (reservationCleanupError) {
        console.error(
          "Failed AI usage reservation could not be removed:",
          reservationCleanupError
        );
      }
    }

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

async function getPdfPageCount(
  fileBytes: Buffer
): Promise<
  | {
      success: true;
      pageCount: number;
    }
  | {
      success: false;
      error: string;
    }
> {
  try {
    const pdf = await PDFDocument.load(
      fileBytes,
      {
        ignoreEncryption: false,
        updateMetadata: false,
      }
    );

    return {
      success: true,
      pageCount: pdf.getPageCount(),
    };
  } catch {
    return {
      success: false,
      error:
        "The PDF could not be read. Password-protected or damaged PDFs cannot be analyzed.",
    };
  }
}

async function getUserPlan(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string
): Promise<UserAiPlan> {
  const defaultPlan: UserAiPlan = {
    plan_name: "standard",
    monthly_ai_limit: STANDARD_MONTHLY_LIMIT,
  };

  const {
    data: existingPlan,
    error: readError,
  } = await supabase
    .from("user_ai_plans")
    .select(
      "plan_name, monthly_ai_limit"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error(
      "AI plan lookup failed. Using Standard plan:",
      readError
    );

    return defaultPlan;
  }

  if (existingPlan) {
    return normalizePlan(existingPlan);
  }

  const {
    data: createdPlan,
    error: createError,
  } = await supabase
    .from("user_ai_plans")
    .insert({
      user_id: userId,
      plan_name: "standard",
      monthly_ai_limit: STANDARD_MONTHLY_LIMIT,
    })
    .select(
      "plan_name, monthly_ai_limit"
    )
    .single();

  if (createError || !createdPlan) {
    console.error(
      "Standard AI plan row could not be created. Using default Standard plan:",
      createError
    );

    return defaultPlan;
  }

  return normalizePlan(createdPlan);
}

function normalizePlan(
  plan: {
    plan_name: string;
    monthly_ai_limit: number | null;
  }
): UserAiPlan {
  const planName: AiPlanName =
    plan.plan_name === "heavy"
      ? "heavy"
      : "standard";

  const fallbackLimit =
    planName === "heavy"
      ? HEAVY_MONTHLY_LIMIT
      : STANDARD_MONTHLY_LIMIT;

  const databaseLimit = Number(
    plan.monthly_ai_limit
  );

  return {
    plan_name: planName,

    monthly_ai_limit:
      Number.isInteger(databaseLimit) &&
      databaseLimit >= 0
        ? databaseLimit
        : fallbackLimit,
  };
}

async function removeUsageReservation(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  reservationId: string,
  userId: string
) {
  const { error } = await supabase
    .from("ai_usage")
    .delete()
    .eq("id", reservationId)
    .eq("user_id", userId)
    .eq("status", "processing");

  if (error) {
    console.error(
      "AI usage reservation could not be removed:",
      error
    );
  }
}

function getCurrentMonthStart() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function getNextMonthStart() {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )
  ).toISOString();
}

function formatPlanName(
  planName: AiPlanName
) {
  return planName === "heavy"
    ? "Heavy"
    : "Standard";
}  