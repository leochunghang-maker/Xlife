import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { Button, SoftCard } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { moodOptions, getAllMemorySnaps } from "../lib/dailyLog";
import { entertainmentNews } from "../lib/entertainment";
import { classNames } from "../lib/utils";
import { Gym } from "./Gym.jsx";
import { planInspirationIdeas, createBlankChoiceBlock, normalizePlan } from "../lib/plans";
import { StoredImage } from "../components/StoredImage.jsx";

export 
function Entertainment({ log, setLog }) {
  const [plans, setPlans] = useState(() => {
    const savedPlans = readLocalJSON("dayflow_fun_plans", []);
    const parsedPlans = Array.isArray(savedPlans) ? savedPlans : [];
    return parsedPlans.map(normalizePlan).filter((plan) => plan.status !== "draft");
  });

  const [entertainmentCategory, setEntertainmentCategory] = useState("Movies");
  const [usTab, setUsTab] = useState("updates");
  const [connectedPartner, setConnectedPartner] = useState(null);
  const [planForm, setPlanForm] = useState({
    title: "",
    content: "",
    date: todayISO,
    inspiration: null,
    choiceBlocks: [createBlankChoiceBlock("What should we do first?")],
  });
  const [planError, setPlanError] = useState("");
  const [aiPlanIdeas, setAiPlanIdeas] = useState([]);
  const entertainmentCategories = [
    { label: "Movies", icon: "🎬" },
    { label: "Shows", icon: "📺" },
    { label: "Music", icon: "🎵" },
  ];
  // Includes memories from earlier days (archived in dayflow_daily_logs).
  const memorySnaps = useMemo(() => getAllMemorySnaps(log), [log]);
  const partnerUpdates = [
    { type: "wake", text: `Wake-up time logged at ${log.wake_up_time || "7:30"} ☀️` },
    { type: "meal", text: log.meals[0]?.name ? `Logged ${log.meals[0].name} for ${log.meals[0].type || "a meal"} 🍜` : "Logged ramen for lunch 🍜" },
    { type: "mood", text: `${connectedPartner?.name || "Emily"} felt ${moodOptions.find((mood) => mood.id === log.mood)?.label.toLowerCase() || "happy"} today ${moodOptions.find((mood) => mood.id === log.mood)?.emoji || "😊"}` },
    { type: "workout", text: "Finished Shoulder/Arm workout 💪" },
    { type: "snap", text: memorySnaps[0]?.caption ? `Shared a memory: ${memorySnaps[0].caption}` : "Shared a snap from today 📸" },
    { type: "notes", text: log.notes ? `Left a note: ${log.notes}` : "Left a small daily note 📝" },
  ];
  const waitingPlans = plans.filter((plan) => plan.status === "sent_to_partner");
  const finalizedPlans = plans.filter((plan) => plan.status === "finalized");

  useEffect(() => {
    writeLocalJSON("dayflow_fun_plans", plans);
  }, [plans]);

  function resetPlanForm() {
    setPlanForm({
      title: "",
      content: "",
      date: todayISO,
      inspiration: null,
      choiceBlocks: [createBlankChoiceBlock("What should we do first?")],
    });
    setAiPlanIdeas([]);
    setPlanError("");
  }

  function suggestPlanIdeas() {
    const categoryIdeas = planInspirationIdeas.filter((idea) => idea.category === entertainmentCategory);
    const fallbackIdeas = planInspirationIdeas.filter((idea) => idea.category !== entertainmentCategory);
    setAiPlanIdeas([...categoryIdeas, ...fallbackIdeas].slice(0, 3));
  }

  function applyPlanIdea(idea) {
    setPlanForm({
      ...planForm,
      title: idea.title,
      content: idea.idea,
      inspiration: idea,
    });
  }

  function updateChoiceBlock(blockId, updates) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.map((block) => block.id === blockId ? { ...block, ...updates } : block),
    });
  }

  function addChoiceBlock() {
    setPlanForm({
      ...planForm,
      choiceBlocks: [...planForm.choiceBlocks, createBlankChoiceBlock()],
    });
  }

  function removeChoiceBlock(blockId) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.filter((block) => block.id !== blockId),
    });
  }

  function updateChoice(blockId, choiceIndex, value) {
    setPlanForm({
      ...planForm,
      choiceBlocks: planForm.choiceBlocks.map((block) => block.id === blockId
        ? {
            ...block,
            choices: block.choices.map((choice, index) => index === choiceIndex ? value : choice),
          }
        : block),
    });
  }

  function validatePlanForm() {
    if (!planForm.title.trim()) return "Add a plan title first.";
    const invalidBlock = planForm.choiceBlocks.find((block) => {
      const choices = block.choices.map((choice) => choice.trim()).filter(Boolean);
      return !block.question.trim() || choices.length < 2;
    });
    return invalidBlock ? "Each choice block needs a question and at least 2 choices." : "";
  }

  function sendPlanToPartner() {
    const error = validatePlanForm();
    if (error) {
      setPlanError(error);
      return;
    }
    const now = new Date().toISOString();
    const choiceBlocks = planForm.choiceBlocks.map((block) => ({
      id: block.id,
      question: block.question.trim(),
      choices: block.choices.map((choice) => choice.trim()),
      partnerChoice: null,
    })).filter((block) => block.question && block.choices.filter(Boolean).length >= 2);

    setPlans([
      ...plans,
      {
        id: createId(),
        title: planForm.title.trim(),
        content: planForm.content,
        date: planForm.date,
        status: "sent_to_partner",
        inspiration: planForm.inspiration,
        choiceBlocks,
        finalPlan: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    resetPlanForm();
    setUsTab("plans");
  }

  function choosePartnerOption(planId, blockId, choiceIndex) {
    const now = new Date().toISOString();
    setPlans(plans.map((plan) => plan.id === planId
      ? {
          ...plan,
          choiceBlocks: plan.choiceBlocks.map((block) => block.id === blockId ? { ...block, partnerChoice: choiceIndex } : block),
          updatedAt: now,
        }
      : plan));
  }

  function confirmPartnerChoices(planId) {
    const target = plans.find((plan) => plan.id === planId);
    const unanswered = (target?.choiceBlocks || []).filter((block) => block.partnerChoice === null || !block.choices[block.partnerChoice]);
    if (unanswered.length) {
      setPlanError(`Pick an option for every question first (${unanswered.length} left).`);
      return;
    }
    setPlanError("");
    const now = new Date().toISOString();
    setPlans(plans.map((plan) => {
      if (plan.id !== planId) return plan;
      const finalPlan = plan.choiceBlocks
        .filter((block) => block.partnerChoice !== null && block.choices[block.partnerChoice])
        .map((block) => ({
          question: block.question,
          selectedChoice: block.choices[block.partnerChoice],
        }));

      return {
        ...plan,
        status: "finalized",
        finalPlan,
        updatedAt: now,
      };
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <SoftCard>
        <div className="mb-4">
          <p id="py5l1x" className="text-2xl font-bold">💕 Us</p>
          <p id="g9lh0k" className="mt-1 text-sm text-zinc-500">Stay connected through daily moments.</p>
        </div>

        {!connectedPartner && (
          <div className="mb-4 rounded-3xl bg-gradient-to-br from-orange-50 to-rose-50 p-4 shadow-sm dark:from-zinc-800 dark:to-zinc-900">
            <p id="tbmjlwm" className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              Connect with your partner to share updates, plans, and memories.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Real two-phone pairing needs the cloud backend (not built yet). The button below opens a local demo preview only.
            </p>
            <Button
              id="0frvww"
              onClick={() => setConnectedPartner({ id: "mock-partner", name: "Emily" })}
              className="mt-3 rounded-2xl bg-[hsl(24_80%_58%)] text-white"
            >
              Preview with demo partner
            </Button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 rounded-3xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {[
            { id: "updates", label: "Updates" },
            { id: "plans", label: "Plans" },
            { id: "memories", label: "Memories" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setUsTab(tab.id)}
              className={classNames(
                "rounded-3xl py-3 text-sm font-bold transition",
                usTab === tab.id
                  ? "bg-[hsl(24_80%_58%)] text-white shadow-sm"
                  : "text-zinc-500"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {usTab === "updates" && (
          <div className="space-y-3">
            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <p className="font-bold">Shared daily feed</p>
              <p className="mt-1 text-sm text-zinc-500">
                Demo preview: these cards are sample updates built from your own log on this phone, not your partner's real activity. Partner sync is planned.
              </p>
            </div>
            {partnerUpdates.map((update) => (
              <div key={`${update.type}-${update.text}`} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[hsl(160_50%_45%)]">{update.type}</p>
                <p className="mt-1 font-semibold text-zinc-700 dark:text-zinc-200">{update.text}</p>
              </div>
            ))}
          </div>
        )}

        {usTab === "plans" && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <div className="mb-3">
                <p className="font-bold">AI date inspiration</p>
                <p className="text-sm text-zinc-500">Start from a few built-in date ideas, then make it yours.</p>
              </div>
              <Button onClick={suggestPlanIdeas} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
                Suggest date ideas
              </Button>
              {aiPlanIdeas.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {aiPlanIdeas.map((idea) => (
                    <div key={idea.title} className="rounded-3xl bg-white p-3 shadow-sm dark:bg-zinc-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{idea.title}</p>
                          <p className="text-xs font-bold text-[hsl(160_50%_45%)]">{idea.category}</p>
                        </div>
                        <Button variant="secondary" onClick={() => applyPlanIdea(idea)} className="rounded-2xl text-xs">
                          Use this idea
                        </Button>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{idea.idea}</p>
                      <p className="mt-1 text-xs text-zinc-500">{idea.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:bg-zinc-900 dark:ring-zinc-800">
              <p className="mb-3 font-bold">Make Plan</p>
              <div className="space-y-3">
                <input
                  className="field"
                  placeholder="Plan title"
                  value={planForm.title}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                />
                <textarea
                  className="min-h-24 w-full rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
                  placeholder="Plan details"
                  value={planForm.content}
                  onChange={(e) => setPlanForm({ ...planForm, content: e.target.value })}
                />
                <input
                  type="date"
                  className="field"
                  value={planForm.date}
                  onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 dark:bg-zinc-800">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">Build choices for the plan</p>
                  <p className="text-sm text-zinc-500">Keep each question simple with two required choices and one optional backup.</p>
                </div>
                <Button variant="secondary" onClick={addChoiceBlock} className="rounded-2xl text-xs">
                  Add block
                </Button>
              </div>

              <div className="space-y-3">
                {planForm.choiceBlocks.map((block) => (
                  <div key={block.id} className="rounded-3xl bg-white p-3 dark:bg-zinc-900">
                    <div className="mb-3 flex gap-2">
                      <input
                        className="field"
                        placeholder="Question"
                        value={block.question}
                        onChange={(e) => updateChoiceBlock(block.id, { question: e.target.value })}
                      />
                      <Button variant="secondary" size="icon" aria-label="Remove question" onClick={() => removeChoiceBlock(block.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <input className="field" placeholder="Choice A" value={block.choices[0] || ""} onChange={(e) => updateChoice(block.id, 0, e.target.value)} />
                      <input className="field" placeholder="Choice B" value={block.choices[1] || ""} onChange={(e) => updateChoice(block.id, 1, e.target.value)} />
                      <input className="field" placeholder="Add another option (optional)" value={block.choices[2] || ""} onChange={(e) => updateChoice(block.id, 2, e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {planError && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-200">{planError}</p>}
            <Button onClick={sendPlanToPartner} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
              Send to Partner
            </Button>

            {waitingPlans.length === 0 && finalizedPlans.length === 0 && (
              <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
                <p className="font-bold">No plans yet</p>
                <p className="mt-1 text-sm text-zinc-500">Send a plan and it will show up here.</p>
              </div>
            )}
            {[
              { title: "Waiting for partner", items: waitingPlans },
              { title: "Final Plan", items: finalizedPlans },
            ].map(({ title, items }) => {
              if (!items.length) return null;

              return (
                <div key={title} className="space-y-2">
                  <p className="text-sm font-black text-zinc-500">{title}</p>
                  {items.map((plan) => (
                    <div key={plan.id} className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 shadow-sm dark:bg-zinc-800">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{plan.title}</p>
                          <p className="text-xs text-zinc-500">{plan.date}</p>
                        </div>
                        <span className={classNames(
                          "rounded-full px-3 py-1 text-xs font-bold capitalize",
                          plan.status === "finalized"
                            ? "bg-[hsl(24_80%_58%)]/10 text-[hsl(24_80%_58%)]"
                            : "bg-[hsl(160_50%_45%)]/10 text-[hsl(160_50%_45%)]"
                        )}>
                          {plan.status.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">{plan.content}</p>
                      {plan.inspiration && (
                        <p className="mt-2 rounded-2xl bg-white p-3 text-xs text-zinc-500 dark:bg-zinc-900">
                          Inspired by {plan.inspiration.category}: {plan.inspiration.title}
                        </p>
                      )}
                      {plan.choiceBlocks.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {plan.choiceBlocks.map((block) => (
                            <div key={block.id} className="rounded-2xl bg-white p-3 dark:bg-zinc-900">
                              <p className="text-sm font-bold">{block.question || "Choice"}</p>
                              <div className="mt-2 grid gap-2">
                                {block.choices.map((choice, index) => (choice ? (
                                  <button
                                    key={`${choice}-${index}`}
                                    onClick={() => plan.status === "sent_to_partner" ? choosePartnerOption(plan.id, block.id, index) : null}
                                    className={classNames(
                                      "rounded-2xl px-3 py-2 text-left text-xs font-semibold",
                                      block.partnerChoice === index
                                        ? "bg-[hsl(24_80%_58%)] text-white"
                                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                                    )}
                                  >
                                    {["A", "B", "C"][index]}. {choice}
                                    {block.partnerChoice === index && " · Partner selected"}
                                  </button>
                                ) : null))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {plan.status === "sent_to_partner" && (
                        <Button onClick={() => confirmPartnerChoices(plan.id)} className="mt-3 w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">
                          Confirm Partner Choices
                        </Button>
                      )}
                      {plan.finalPlan.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-[hsl(24_80%_58%)]/10 p-3">
                          <p className="text-sm font-bold text-[hsl(24_80%_58%)]">Final Plan</p>
                          <div className="mt-2 space-y-1">
                            {plan.finalPlan.map((item, index) => (
                              <p key={`${item.selectedChoice}-${index}`} className="text-xs text-zinc-600 dark:text-zinc-300">
                                {item.question}: {item.selectedChoice}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {usTab === "memories" && (
          <div className="space-y-4">
            {memorySnaps.length === 0 ? (
              <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center">
                <p className="font-bold">No shared memories yet</p>
                <p className="mt-1 text-sm text-zinc-500">Save a snap as a memory and it will appear here.</p>
              </div>
            ) : (
              memorySnaps.map((snap, index) => (
                <div key={`${snap.id || snap.taken_at || "snap"}-${index}`} className="overflow-hidden rounded-3xl bg-zinc-100 shadow-sm dark:bg-zinc-800">
                  <StoredImage src={snap.url} className="h-48 w-full object-cover" alt={snap.caption || "Memory"} />

                  <div className="p-3 text-sm">
                    <p className="font-semibold">{snap.caption || "An Xlife moment"}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {snap.taken_at ? new Date(snap.taken_at).toLocaleString() : "Saved memory"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SoftCard>

      <Gym log={log} setLog={setLog} />

      <SoftCard>
        <div className="mb-5">
          <p className="text-3xl font-bold tracking-tight">Entertainment</p>
          <p className="mt-1 text-sm text-zinc-500">Discover what&apos;s trending</p>
          <p className="mt-1 text-xs text-zinc-400">Sample headlines for now, not live news.</p>
        </div>

        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-[hsl(24_80%_58%)] px-6 py-3 text-sm font-bold text-white shadow-sm">
            🎬 What&apos;s On
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {entertainmentCategories.map((category) => {
            const selected = entertainmentCategory === category.label;
            return (
              <button
                key={category.label}
                onClick={() => setEntertainmentCategory(category.label)}
                className={classNames(
                  "rounded-full px-3 py-3 text-sm font-bold shadow-sm transition",
                  selected
                    ? "bg-[hsl(24_80%_58%)] text-white"
                    : "bg-[hsl(30_30%_98%)] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                {category.icon} {category.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {entertainmentNews[entertainmentCategory].map((news) => (
            <div
              key={news}
              className="rounded-3xl bg-[hsl(30_30%_98%)] p-4 text-sm font-medium text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200"
            >
              {news}
            </div>
          ))}
        </div>
      </SoftCard>
    </motion.div>
  );
}
