export type SiftQuestionCategoryId = "how_to" | "common";

export interface SiftQuestionCategory {
  id: SiftQuestionCategoryId;
  label: string;
  icon: string;
  questions: string[];
}

/**
 * The complete question catalogue shown by SiftChat. Keeping it in one data
 * file makes the supported chatbot scope explicit and easy to extend.
 */
export const SIFT_QUESTION_CATEGORIES: SiftQuestionCategory[] = [
  {
    id: "how_to",
    label: "How to use the app",
    icon: "🧭",
    questions: [
      "Where is the Filter button?",
      "Where is the like button?",
      "Where are my saved places?",
      "How do I compare saved listings?",
      "Where can I read reviews and details?",
      "How do I report a suspicious listing?",
      "Where is the map button?",
      "Where do I change the commute mode?",
      "Where do I explore different areas?",
      "Where is the rental safety and moving guide?",
      "Where is the dark mode button?",
      "How do I see the next page of results?",
      "Where are the booking buttons?",
      "Where do I change my budget, dates, or preferences?",
    ],
  },
  {
    id: "common",
    label: "Common questions",
    icon: "💡",
    questions: [
      "How is true monthly cost calculated?",
      "How is commute cost calculated?",
      "Are utilities, internet, mobile, and food included?",
      "How are places ranked?",
      "What does the match percentage mean?",
      "What do Top pick, Best value, and Best quality mean?",
      "Which place is better?",
      "Which place is the cheapest?",
      "Which place has the shortest commute?",
      "Where does the listing and price data come from?",
      "What does Price on request mean?",
    ],
  },
];
