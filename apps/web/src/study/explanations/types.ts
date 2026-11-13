/** Context/definition, everyday explanation, concrete example. Original technical blocks remain intact. */
export type Explanation = readonly [context: string, simple: string, example: string];
export type Explanations = Record<string, Explanation>;
