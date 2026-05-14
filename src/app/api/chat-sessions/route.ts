import { NextResponse } from "next/server";
import { z } from "zod";

import { createChatSession, getDocumentById } from "@/lib/db/queries";

export const runtime = "nodejs";

const createChatSessionSchema = z.object({
  documentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = createChatSessionSchema.parse(await request.json());
    const document = getDocumentById(payload.documentId);

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const chatSession = createChatSession({
      documentId: payload.documentId,
      title: "New chat",
    });

    return NextResponse.json({ chatSession });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create a new chat session.",
      },
      { status: 500 },
    );
  }
}
