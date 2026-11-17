import type {RecommendationArea} from './recommendation-areas.mjs';
export type KnowledgeSource={id:string;course:string;lecture:string;speaker:string;query?:string};
export type KnowledgeExpert={sourceId:string;speaker:string;role:string;course:string;lecture:string;text:string};
export type ProductKnowledge={sourceProductId?:string;about:string[];highlights:string[];benefit:string;recommendations:{area:RecommendationArea;reason:string}[];pairs:{productId:string;why:string}[];sources:KnowledgeSource[];experts?:KnowledgeExpert[]};
