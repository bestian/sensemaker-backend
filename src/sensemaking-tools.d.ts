declare module 'sensemaking-tools' {
  // 基本的 Comment 類型
  export interface Comment {
    id: string;
    text: string;
    timestamp?: string;
    metadata?: Record<string, any>;
    voteInfo?: any;
  }

  // 基本的 Topic 類型
  export interface Topic {
    id: string;
    name: string;
    description?: string;
    comments?: Comment[];
    metadata?: Record<string, any>;
  }

  // 其他可能需要的類型可以根據實際使用情況添加
  export interface SensemakingResult {
    topics: Topic[];
    summary?: string;
    metadata?: Record<string, any>;
  }

  // 類別宣告
  export class Sensemaker {
    constructor(config: { defaultModel: any });
    learnTopics(comments: Comment[], includeVotes?: boolean, topics?: Topic[], context?: string, maxTopics?: number, language?: string): Promise<Topic[]>;
    categorizeComments(comments: Comment[], includeVotes?: boolean, topics?: Topic[], context?: string, maxTopics?: number, language?: string): Promise<Comment[]>;
    summarize(comments: Comment[], type: SummarizationType, topics?: Topic[], context?: string, language?: string): Promise<any>;
  }

  export class OpenRouterModel {
    constructor(apiKey: string, model: string, baseURL?: string);
    generateText(prompt: string, language?: string): Promise<string>;
    generateData(prompt: string, schema: any, language?: string): Promise<any>;
  }

  export enum SummarizationType {
    AGGREGATE_VOTE = 'AGGREGATE_VOTE'
  }

  export class VoteTally {
    constructor(agree: number, disagree: number, pass: number);
    agreeCount: number;
    disagreeCount: number;
    passCount: number;
    getTotalCount(includePass?: boolean): number;
  }

  // 函數簽名
  export function analyzeComments(comments: Comment[]): Promise<SensemakingResult>;
  export function categorizeTopics(comments: Comment[]): Promise<Topic[]>;
  export function generateSummary(comments: Comment[]): Promise<string>;
}
