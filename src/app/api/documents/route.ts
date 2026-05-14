import { NextResponse } from "next/server";

import { deleteAllDocuments } from "@/lib/db/queries";
import { cleanupDocumentFiles } from "@/lib/utils/file";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const documents = deleteAllDocuments();
    await Promise.all(documents.map((document) => cleanupDocumentFiles(document)));

    return NextResponse.json({
      cleared: true,
      count: documents.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not clear saved sources.",
      },
      { status: 500 },
    );
  }
}
