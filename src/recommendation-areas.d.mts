export type RecommendationArea = 'women'|'energy'|'stress'|'digestion'|'bowel'|'immunity'|'beauty'|'joints'|'weight'|'heart'|'eyes'|'nutrition'|'men';
export const recommendationAreas:Record<RecommendationArea,{title:string;products:[string,string][]}>;
