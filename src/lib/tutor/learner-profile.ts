import { z } from "zod";

export const explanationLanguages = ["hinglish", "hindi", "english"] as const;
export const learnerLevels = ["school", "college", "beginner"] as const;

export const learnerProfileSchema = z.object({
  explanationLanguage: z.enum(explanationLanguages).default("hinglish"),
  learnerLevel: z.enum(learnerLevels).default("school"),
  contextTag: z.string().trim().max(120).default("science student"),
  transliterateToRoman: z.boolean().default(true),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

export const defaultLearnerProfile: LearnerProfile = {
  explanationLanguage: "hinglish",
  learnerLevel: "school",
  contextTag: "science student",
  transliterateToRoman: true,
};

export function getLanguageLabel(language: LearnerProfile["explanationLanguage"]) {
  switch (language) {
    case "hindi":
      return "Hindi";
    case "english":
      return "English";
    default:
      return "Hinglish";
  }
}
