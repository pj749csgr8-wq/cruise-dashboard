"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/server";

const BUCKET_NAME = "cruise-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function uploadCruiseDocument(
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

  const fileValue = formData.get("file");
  const documentType = String(
    formData.get("document_type") || "Other"
  ).trim();
  const description = String(
    formData.get("description") || ""
  ).trim();

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    throw new Error("Select a file to upload.");
  }

  if (fileValue.size > MAX_FILE_SIZE) {
    throw new Error("The file must be 10 MB or smaller.");
  }

  if (!allowedTypes.has(fileValue.type)) {
    throw new Error("That file type is not supported.");
  }

  const { data: cruise } = await supabase
    .from("cruises")
    .select("id")
    .eq("id", cruiseId)
    .single();

  if (!cruise) {
    throw new Error("Cruise not found.");
  }

  const safeFileName = fileValue.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  const filePath =
    `${user.id}/${cruiseId}/${randomUUID()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileValue, {
      contentType: fileValue.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Unable to upload file: ${uploadError.message}`);
  }

  const { error: recordError } = await supabase
    .from("cruise_documents")
    .insert({
      user_id: user.id,
      cruise_id: cruiseId,
      file_name: fileValue.name,
      file_path: filePath,
      document_type: documentType || "Other",
      description: description || null,
    });

  if (recordError) {
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    throw new Error(
      `Unable to save document record: ${recordError.message}`
    );
  }

  revalidatePath(`/dashboard/cruises/${cruiseId}/documents`);
  redirect(`/dashboard/cruises/${cruiseId}/documents`);
}

export async function deleteCruiseDocument(
  cruiseId: string,
  documentId: string
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: document, error: documentError } = await supabase
    .from("cruise_documents")
    .select("id, file_path")
    .eq("id", documentId)
    .eq("cruise_id", cruiseId)
    .single();

  if (documentError || !document) {
    throw new Error("Document not found.");
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([document.file_path]);

  if (storageError) {
    throw new Error(
      `Unable to remove stored file: ${storageError.message}`
    );
  }

  const { error: recordError } = await supabase
    .from("cruise_documents")
    .delete()
    .eq("id", documentId)
    .eq("cruise_id", cruiseId);

  if (recordError) {
    throw new Error(
      `Unable to delete document record: ${recordError.message}`
    );
  }

  revalidatePath(`/dashboard/cruises/${cruiseId}/documents`);
}