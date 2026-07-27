"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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

type AiUsage = {
  plan: "standard" | "heavy";
  used: number;
  limit: number;
  remaining: number;
  resets_at: string;
};

type AnalysisResponse = {
  success: boolean;

  file: {
    name: string;
    type: string;
    size: number;
  };

  usage: AiUsage;
  analysis: TravelAnalysis;
};

type ErrorResponse = {
  error?: string;
  code?: string;
  usage?: AiUsage;
};

type UsageResponse = {
  success?: boolean;
  usage?: AiUsage;
  error?: string;
};

type SaveResponse = {
  success?: boolean;
  error?: string;

  item?: {
    id: string;
    item_type: string;
    title: string;
  };
};

type TravelAnalyzerProps = {
  cruiseId: string;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export default function TravelAnalyzer({
  cruiseId,
}: TravelAnalyzerProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [analysis, setAnalysis] =
    useState<TravelAnalysis | null>(null);

  const [usage, setUsage] =
    useState<AiUsage | null>(null);

  const [usageLoading, setUsageLoading] =
    useState(true);

  const [usageError, setUsageError] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      setUsageLoading(true);
      setUsageError("");

      try {
        const response = await fetch(
          "/api/ai-usage",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result =
          (await response.json()) as UsageResponse;

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Your AI allowance could not be loaded."
          );
        }

        if (
          !result.usage
        ) {
          throw new Error(
            "The server did not return your AI allowance."
          );
        }

        if (!cancelled) {
          setUsage(result.usage);
        }
      } catch (error) {
        if (!cancelled) {
          setUsageError(
            error instanceof Error
              ? error.message
              : "Your AI allowance could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setUsageLoading(false);
        }
      }
    }

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null;

    setSelectedFile(null);
    setAnalysis(null);
    setErrorMessage("");
    setSaveMessage("");

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (!file) {
      return;
    }

    if (
      !ALLOWED_FILE_TYPES.includes(file.type)
    ) {
      setErrorMessage(
        "Choose a JPG, PNG, WebP or PDF file."
      );

      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        "The selected file must be 5 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    setPreviewUrl(
      URL.createObjectURL(file)
    );
  }

  async function handleAnalyze(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage(
        "Choose a file before starting the analysis."
      );

      return;
    }

    if (
      usage &&
      usage.remaining <= 0
    ) {
      setErrorMessage(
        `You have used all ${usage.limit} AI analyses available this month. Your allowance resets ${formatResetDate(
          usage.resets_at
        )}.`
      );

      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setSaveMessage("");
    setAnalysis(null);

    try {
      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      formData.append(
        "cruiseId",
        cruiseId
      );

      const response = await fetch(
        "/api/analyze-travel-document",
        {
          method: "POST",
          body: formData,
        }
      );

      const result =
        (await response.json()) as
          | AnalysisResponse
          | ErrorResponse;

      if (
        "usage" in result &&
        result.usage
      ) {
        setUsage(result.usage);
      }

      if (!response.ok) {
        throw new Error(
          "error" in result &&
          result.error
            ? result.error
            : "The document could not be analyzed."
        );
      }

      if (
        !("analysis" in result) ||
        !result.analysis
      ) {
        throw new Error(
          "The AI did not return usable travel details."
        );
      }

      setAnalysis(result.analysis);
      setUsage(result.usage);
      setUsageError("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSave() {
    if (
      !selectedFile ||
      !analysis
    ) {
      setErrorMessage(
        "Analyze a document before saving it."
      );

      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const formData = new FormData();

      formData.append(
        "file",
        selectedFile
      );

      formData.append(
        "cruiseId",
        cruiseId
      );

      formData.append(
        "analysis",
        JSON.stringify(analysis)
      );

      const response = await fetch(
        "/api/save-travel-item",
        {
          method: "POST",
          body: formData,
        }
      );

      const result =
        (await response.json()) as SaveResponse;

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            "The travel item could not be saved."
        );
      }

      setSaveMessage(
        `${
          result.item?.title ||
          formatItemType(
            analysis.item_type
          )
        } was saved to this cruise.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetAnalyzer() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setErrorMessage("");
    setSaveMessage("");
    setIsAnalyzing(false);
    setIsSaving(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const limitReached =
    usage !== null &&
    usage.remaining <= 0;

  return (
    <div className="p-6 sm:p-10">
      {usageLoading && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-bold text-slate-900">
            Loading AI allowance...
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Checking your monthly usage.
          </p>
        </section>
      )}

      {!usageLoading &&
        usage && (
          <UsageCard usage={usage} />
        )}

      {!usageLoading &&
        usageError && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <p className="font-bold">
              AI allowance unavailable
            </p>

            <p className="mt-1 text-sm leading-6">
              {usageError}
            </p>
          </section>
        )}

      <form
        onSubmit={handleAnalyze}
        className={
          usageLoading ||
          usage ||
          usageError
            ? "mt-6 space-y-6"
            : "space-y-6"
        }
      >
        <div>
          <label
            htmlFor="travel-document"
            className="mb-2 block text-sm font-bold text-slate-700"
          >
            Travel document
          </label>

          <input
            ref={fileInputRef}
            id="travel-document"
            name="travel-document"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={
              isAnalyzing ||
              isSaving ||
              limitReached ||
              usageLoading
            }
            className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:font-bold file:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Accepted formats: JPG, PNG,
            WebP and PDF. Maximum file
            size: 5 MB. PDFs may contain
            no more than 10 pages.
          </p>
        </div>

        {previewUrl &&
          selectedFile && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="font-bold text-slate-900">
                  Selected document
                </p>

                <p className="mt-1 break-all text-sm text-slate-500">
                  {selectedFile.name} ·{" "}
                  {formatFileSize(
                    selectedFile.size
                  )}
                </p>
              </div>

              {selectedFile.type ===
              "application/pdf" ? (
                <div className="bg-slate-900 p-4">
                  <iframe
                    src={previewUrl}
                    title="Selected PDF preview"
                    className="h-[520px] w-full rounded-xl bg-white"
                  />

                  <div className="mt-4 rounded-xl bg-slate-800 p-4 text-center text-white">
                    <p className="text-3xl">
                      📄
                    </p>

                    <p className="mt-2 font-bold">
                      PDF selected
                    </p>

                    <p className="mt-1 break-all text-sm text-slate-300">
                      {selectedFile.name}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex max-h-[520px] items-center justify-center bg-slate-900 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected travel document preview"
                    className="max-h-[480px] max-w-full rounded-lg object-contain"
                  />
                </div>
              )}
            </section>
          )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">
            <p className="font-bold">
              The document could not be
              processed
            </p>

            <p className="mt-1 text-sm leading-6">
              {errorMessage}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={
              !selectedFile ||
              isAnalyzing ||
              isSaving ||
              limitReached ||
              usageLoading
            }
            className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {usageLoading
              ? "Checking allowance..."
              : limitReached
                ? "Monthly AI limit reached"
                : isAnalyzing
                  ? "Analyzing document..."
                  : analysis
                    ? "Analyze again"
                    : "Analyze with AI"}
          </button>

          {(selectedFile ||
            analysis) && (
            <button
              type="button"
              onClick={resetAnalyzer}
              disabled={
                isAnalyzing ||
                isSaving
              }
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Choose another file
            </button>
          )}
        </div>
      </form>

      {analysis && (
        <>
          <AnalysisResults
            analysis={analysis}
          />

          <section className="mt-8 border-t border-slate-200 pt-8">
            {saveMessage && (
              <div className="mb-5 rounded-2xl border border-green-300 bg-green-50 p-5 text-green-900">
                <p className="font-bold">
                  Saved successfully
                </p>

                <p className="mt-1 text-sm">
                  {saveMessage}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={
                isSaving ||
                isAnalyzing ||
                Boolean(saveMessage)
              }
              className="w-full rounded-xl bg-green-700 px-6 py-4 text-lg font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isSaving
                ? "Saving to cruise..."
                : saveMessage
                  ? "Saved to cruise"
                  : `Save as ${formatItemType(
                      analysis.item_type
                    )}`}
            </button>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              This saves the original
              document and the extracted
              information under the
              selected cruise.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function UsageCard({
  usage,
}: {
  usage: AiUsage;
}) {
  const percentageUsed =
    usage.limit > 0
      ? Math.min(
          Math.max(
            (usage.used /
              usage.limit) *
              100,
            0
          ),
          100
        )
      : 100;

  const limitReached =
    usage.remaining <= 0;

  return (
    <section
      className={
        limitReached
          ? "rounded-2xl border border-red-300 bg-red-50 p-5"
          : "rounded-2xl border border-blue-200 bg-blue-50 p-5"
      }
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p
            className={
              limitReached
                ? "text-xs font-bold uppercase tracking-[0.16em] text-red-700"
                : "text-xs font-bold uppercase tracking-[0.16em] text-blue-700"
            }
          >
            {formatPlanName(
              usage.plan
            )}{" "}
            plan
          </p>

          <p className="mt-1 text-xl font-bold text-slate-900">
            {usage.remaining} of{" "}
            {usage.limit} AI analyses
            remaining
          </p>

          <p className="mt-1 text-sm text-slate-600">
            {usage.used} used this
            month · Resets{" "}
            {formatResetDate(
              usage.resets_at
            )}
          </p>
        </div>

        <div
          className={
            limitReached
              ? "rounded-xl bg-red-100 px-4 py-3 text-center text-red-800"
              : "rounded-xl bg-white px-4 py-3 text-center text-blue-800 shadow-sm"
          }
        >
          <p className="text-2xl font-bold">
            {usage.remaining}
          </p>

          <p className="text-xs font-bold uppercase tracking-wider">
            remaining
          </p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div
          className={
            limitReached
              ? "h-full rounded-full bg-red-600 transition-all"
              : "h-full rounded-full bg-blue-700 transition-all"
          }
          style={{
            width: `${percentageUsed}%`,
          }}
        />
      </div>

      {limitReached && (
        <p className="mt-4 text-sm font-semibold text-red-800">
          Your monthly AI allowance
          has been used. Manual
          document uploads are still
          available.
        </p>
      )}
    </section>
  );
}

function AnalysisResults({
  analysis,
}: {
  analysis: TravelAnalysis;
}) {
  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
            AI analysis complete
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {analysis.title ||
              formatItemType(
                analysis.item_type
              )}
          </h2>

          <p className="mt-2 max-w-3xl leading-6 text-slate-600">
            {analysis.ai_summary}
          </p>
        </div>

        <ConfidenceBadge
          confidence={
            analysis.ai_confidence
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800">
          {formatItemType(
            analysis.item_type
          )}
        </span>

        {analysis.company_name && (
          <span className="rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            {analysis.company_name}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ResultField
          label="Company"
          value={
            analysis.company_name
          }
        />

        <ResultField
          label="Confirmation number"
          value={
            analysis.confirmation_number
          }
        />

        <ResultField
          label="Reference number"
          value={
            analysis.reference_number
          }
        />

        <ResultField
          label="Start date"
          value={formatOptionalDate(
            analysis.start_date
          )}
        />

        <ResultField
          label="Start time"
          value={formatOptionalTime(
            analysis.start_time
          )}
        />

        <ResultField
          label="End date"
          value={formatOptionalDate(
            analysis.end_date
          )}
        />

        <ResultField
          label="End time"
          value={formatOptionalTime(
            analysis.end_time
          )}
        />

        <ResultField
          label="Flight number"
          value={
            analysis.flight_number
          }
        />

        <ResultField
          label="Terminal"
          value={analysis.terminal}
        />

        <ResultField
          label="Gate"
          value={analysis.gate}
        />

        <ResultField
          label="Departure or pickup"
          value={
            analysis.departure_location
          }
        />

        <ResultField
          label="Arrival or destination"
          value={
            analysis.arrival_location
          }
        />

        <ResultField
          label="Address"
          value={analysis.address}
        />

        <ResultField
          label="Cost"
          value={formatCost(
            analysis.cost,
            analysis.currency
          )}
        />
      </div>

      {analysis.notes && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Additional details
          </p>

          <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">
            {analysis.notes}
          </p>
        </div>
      )}

      <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <p className="font-bold">
          Review the information
          carefully
        </p>

        <p className="mt-1 text-sm leading-6">
          AI can misread dates,
          confirmation numbers,
          prices and airport codes.
          Check the details before
          saving them to the cruise.
        </p>
      </div>
    </section>
  );
}

function ResultField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words font-semibold text-slate-900">
        {value || "Not found"}
      </p>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: number;
}) {
  let classes =
    "border-red-200 bg-red-50 text-red-800";

  if (confidence >= 80) {
    classes =
      "border-green-200 bg-green-50 text-green-800";
  } else if (confidence >= 60) {
    classes =
      "border-amber-200 bg-amber-50 text-amber-800";
  }

  return (
    <div
      className={`shrink-0 rounded-2xl border px-5 py-4 ${classes}`}
    >
      <p className="text-xs font-bold uppercase tracking-wider">
        AI confidence
      </p>

      <p className="mt-1 text-2xl font-bold">
        {Math.round(confidence)}%
      </p>
    </div>
  );
}

function formatPlanName(
  planName: AiUsage["plan"]
) {
  return planName === "heavy"
    ? "Heavy"
    : "Standard";
}

function formatResetDate(
  dateValue: string
) {
  const parsedDate =
    new Date(dateValue);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(parsedDate);
}

function formatItemType(
  itemType: string
) {
  return itemType
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatOptionalDate(
  date: string | null
) {
  if (!date) {
    return null;
  }

  const parsedDate = new Date(
    `${date}T00:00:00Z`
  );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(parsedDate);
}

function formatOptionalTime(
  time: string | null
) {
  if (!time) {
    return null;
  }

  const [
    hourText,
    minuteText,
  ] = time.split(":");

  const hour = Number(hourText);
  const minute =
    Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return time;
  }

  const date = new Date();

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function formatCost(
  cost: number | null,
  currency: string | null
) {
  if (cost === null) {
    return null;
  }

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency:
          currency || "USD",
      }
    ).format(cost);
  } catch {
    return `${
      currency || "USD"
    } ${cost.toFixed(2)}`;
  }
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}