import { NextResponse } from "next/server";

import { deleteDocumentById } from "@/lib/db/queries";
import { cleanupDocumentFiles } from "@/lib/utils/file";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const document = deleteDocumentById(documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    await cleanupDocumentFiles(document);

    return NextResponse.json({
      removed: true,
      documentId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not remove that source.",
      },
      { status: 500 },
    );
  }
}
