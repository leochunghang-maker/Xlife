export const schema = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "items", "total", "confidence", "notes"],
  properties: {
    is_food: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "portion",
          "calories",
          "protein_g",
          "carbs_g",
          "fat_g",
          "sugar_g",
        ],
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          sugar_g: { type: "number" },
        },
      },
    },
    total: {
      type: "object",
      additionalProperties: false,
      required: ["calories", "protein_g", "carbs_g", "fat_g", "sugar_g"],
      properties: {
        calories: { type: "number" },
        protein_g: { type: "number" },
        carbs_g: { type: "number" },
        fat_g: { type: "number" },
        sugar_g: { type: "number" },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
};
