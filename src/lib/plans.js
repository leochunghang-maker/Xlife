import { createId } from "./storage";
import { todayISO } from "./dates";

export 
const planInspirationIdeas = [
  {
    title: "Movie + dessert night",
    category: "Movies",
    idea: "Watch a trending romantic movie, then try a new dessert cafe.",
    reason: "Based on your interest in cozy plans and entertainment.",
  },
  {
    title: "Live music dinner walk",
    category: "Music",
    idea: "Pick a casual dinner spot, then find a small live set nearby.",
    reason: "Music plans work well when you want something low-pressure but memorable.",
  },
  {
    title: "Series premiere snack date",
    category: "Shows",
    idea: "Start a buzzed-about show and build a snack board around it.",
    reason: "A good pick for staying in while still making the night feel planned.",
  },
  {
    title: "Celebrity restaurant crawl",
    category: "Celebrity",
    idea: "Try a spot inspired by a celebrity food trend, then vote on dessert.",
    reason: "Turns pop-culture curiosity into an easy shared adventure.",
  },
  {
    title: "Slow morning date",
    category: "Date ideas",
    idea: "Brunch, a short walk, and one choose-your-own stop afterward.",
    reason: "Flexible enough for both of you to shape the day together.",
  },
];
export 
function createBlankChoiceBlock(question = "") {
  return {
    id: createId(),
    question,
    choices: ["", "", ""],
    partnerChoice: null,
  };
}
export 
function normalizePlan(plan) {
  const now = new Date().toISOString();
  const choiceBlocks = (plan.choiceBlocks || []).map((block) => ({
    id: block.id || createId(),
    question: block.question || "",
    choices: block.choices || (block.options || []).map((option) => option.text || "").concat(["", "", ""]).slice(0, 3),
    partnerChoice: block.partnerChoice ?? null,
  }));

  return {
    id: plan.id || createId(),
    title: plan.title || "Untitled plan",
    content: plan.content || "",
    date: plan.date || todayISO,
    status: plan.status || "draft",
    inspiration: plan.inspiration || null,
    choiceBlocks,
    finalPlan: plan.finalPlan || plan.finalizedItinerary?.map((item) => ({ question: item.section, selectedChoice: item.text })) || [],
    createdAt: plan.createdAt || now,
    updatedAt: plan.updatedAt || now,
  };
}
