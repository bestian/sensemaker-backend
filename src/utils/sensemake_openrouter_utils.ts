// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific language governing
// permissions and limitations under the License.

// 這個文件包含了 sensemaker-backend 的 CSV 解析工具
// 參考 sensemaking-tools/library/runner-cli/runner_openrouter_utils.ts 的實現

import { Comment, Topic, VoteTally } from 'sensemaking-tools';

// 類型定義，參考 runner_openrouter_utils.ts
export type CoreCommentCsvRow = {
  index?: number;
  timestamp?: number;
  datetime?: string;
  "comment-id": number;
  "author-id"?: number;
  agrees: number;
  disagrees: number;
  moderated?: number;
  comment_text: string;
  passes: number;
  topics?: string; // 可以包含主題和子主題
  topic?: string;
  subtopic?: string;
};

// 分組投票的鍵名格式
export type VoteTallyGroupKey = `${string}-agree-count` | `${string}-disagree-count` | `${string}-pass-count`;

export interface VoteTallyCsvRow {
  [key: VoteTallyGroupKey]: number;
}

// 完整的 CSV 行類型
export type CommentCsvRow = VoteTallyCsvRow & CoreCommentCsvRow;

/**
 * 解析 CSV 文件，支持完整的 comments.csv 格式
 * 包括分組投票和主題信息
 */
export async function parseCSVFile(file: File): Promise<Comment[]> {
	const csvText = await file.text();
	const lines = csvText.trim().split('\n');
	
	if (lines.length < 2) {
		throw new Error('CSV file must have at least a header row and one data row');
	}

	const headers = lines[0].split(',').map(h => h.trim());
	const dataLines = lines.slice(1);

	// 查找必要的列
	const idIndex = headers.findIndex(h => h === 'comment-id' || h === 'id');
	const textIndex = headers.findIndex(h => h === 'comment_text' || h === 'text');
	
	if (idIndex === -1 || textIndex === -1) {
		throw new Error('CSV must contain comment-id (or id) and comment_text (or text) columns');
	}

	// 查找投票相關列
	const voteColumns = headers.filter(h => 
		h.includes('-agree-count') || 
		h.includes('-disagree-count') || 
		h.includes('-pass-count') ||
		h === 'agrees' || 
		h === 'disagrees' || 
		h === 'passes'
	);

	// 檢查是否有群組信息
	const hasGroupInfo = voteColumns.some(col => col.includes('-agree-count'));
	const groupNames: string[] = [];
	
	if (hasGroupInfo) {
		// 提取群組名稱
		groupNames.push(...new Set(voteColumns.map(col => col.split('-')[0])));
	}

	return dataLines.map((line, index) => {
		const values = line.split(',').map(v => v.trim());
		
		const comment: Comment = {
			id: values[idIndex] || `comment-${index}`,
			text: values[textIndex] || ''
		};

		// 處理投票信息
		if (voteColumns.length > 0) {
			if (hasGroupInfo) {
				// 群組投票格式: {group name}-agree-count, {group name}-disagree-count, {group name}-pass-count
				const voteInfo: { [key: string]: VoteTally } = {};
				groupNames.forEach(group => {
					const agreeCol = headers.findIndex(h => h === `${group}-agree-count`);
					const disagreeCol = headers.findIndex(h => h === `${group}-disagree-count`);
					const passCol = headers.findIndex(h => h === `${group}-pass-count`);
					
					if (agreeCol !== -1 && disagreeCol !== -1) {
						voteInfo[group] = new VoteTally(
							parseInt(values[agreeCol]) || 0,
							parseInt(values[disagreeCol]) || 0,
							passCol !== -1 ? (parseInt(values[passCol]) || 0) : 0
						);
					}
				});
				
				if (Object.keys(voteInfo).length > 0) {
					comment.voteInfo = voteInfo;
				}
			} else {
				// 簡單投票格式: agrees, disagrees, passes
				const agreesIndex = headers.findIndex(h => h === 'agrees');
				const disagreesIndex = headers.findIndex(h => h === 'disagrees');
				const passesIndex = headers.findIndex(h => h === 'passes');
				
				if (agreesIndex !== -1 && disagreesIndex !== -1) {
					comment.voteInfo = new VoteTally(
						parseInt(values[agreesIndex]) || 0,
						parseInt(values[disagreesIndex]) || 0,
						passesIndex !== -1 ? (parseInt(values[passesIndex]) || 0) : 0
					);
				}
			}
		}

		// 處理主題信息（如果存在）
		const topicsIndex = headers.findIndex(h => h === 'topics');
		const topicIndex = headers.findIndex(h => h === 'topic');
		const subtopicIndex = headers.findIndex(h => h === 'subtopic');
		
		if (topicsIndex !== -1 && values[topicsIndex]) {
			// 解析主題字符串
			comment.topics = parseTopicsString(values[topicsIndex]);
		} else if (topicIndex !== -1 && values[topicIndex]) {
			// 單個主題和子主題
			comment.topics = [{
				name: values[topicIndex],
				subtopics: subtopicIndex !== -1 && values[subtopicIndex] ? 
					[{ name: values[subtopicIndex] }] : []
			}];
		}

		return comment;
	});
}

/**
 * 從 CSV 行獲取投票信息
 */
export function getVoteInfoFromCsvRow(
	row: CommentCsvRow,
	usesGroups: boolean,
	groupNames: string[]
): any {
	if (usesGroups) {
		// 分組投票格式
		const voteInfo: { [key: string]: VoteTally } = {};
		for (const groupName of groupNames) {
			voteInfo[groupName] = new VoteTally(
				Number(row[`${groupName}-agree-count`] || 0),
				Number(row[`${groupName}-disagree-count`] || 0),
				Number(row[`${groupName}-pass-count`] || 0)
			);
		}
		return voteInfo;
	} else {
		// 簡單投票格式
		return new VoteTally(
			Number(row.agrees || 0), 
			Number(row.disagrees || 0), 
			Number(row.passes || 0)
		);
	}
}

/**
 * 解析主題字符串，完全參考 runner_openrouter_utils.ts 的實現
 */
export function parseTopicsString(topicsString: string): Topic[] {
	if (!topicsString || topicsString.trim() === '') {
		return [];
	}

	// 使用與 runner_openrouter_utils.ts 完全相同的邏輯
	const subtopicMappings = topicsString
		.split(';')
		.reduce(
			(
				topicMapping: { [key: string]: Topic[] },
				topicString: string
			): { [key: string]: Topic[] } => {
				const [topicName, subtopicName, subsubtopicName] = topicString.split(':');
				
				// 如果還沒有這個主題的映射，創建一個
				topicMapping[topicName] = topicMapping[topicName] || [];
				
				if (subtopicName) {
					let subsubtopic: Topic[] = [];
					let subtopicUpdated = false;
					
					// 檢查現有的子主題並添加子子主題
					for (const subtopic of topicMapping[topicName]) {
						if (subtopic.name === subtopicName) {
							subsubtopic = 'subtopics' in subtopic ? subtopic.subtopics : [];
							if (subsubtopicName) {
								subsubtopic.push({ name: subsubtopicName });
								subtopicUpdated = true;
								break;
							}
						}
					}

					if (subsubtopicName) {
						subsubtopic = [{ name: subsubtopicName }];
					}
					
					if (!subtopicUpdated) {
						topicMapping[topicName].push({ name: subtopicName, subtopics: subsubtopic });
					}
				}

				return topicMapping;
			},
			{}
		);

	// 將鍵值對映射到 Topic 對象
	return Object.entries(subtopicMappings).map(([topicName, subtopics]) => {
		if (subtopics.length === 0) {
			return { name: topicName };
		} else {
			return { name: topicName, subtopics: subtopics };
		}
	});
}

/**
 * 從評論中提取主題信息
 */
export function getTopicsFromComments(comments: Comment[]): Topic[] {
	// 創建從主題名稱到子主題名稱集合的映射
	const mapTopicToSubtopicSet: { [topicName: string]: Set<string> } = {};
	
	for (const comment of comments) {
		for (const topic of comment.topics || []) {
			if (mapTopicToSubtopicSet[topic.name] == undefined) {
				mapTopicToSubtopicSet[topic.name] = new Set();
			}
			if ("subtopics" in topic) {
				for (const subtopic of topic.subtopics || []) {
					mapTopicToSubtopicSet[topic.name].add(subtopic.name);
				}
			}
		}
	}

	// 將映射轉換為 Topic 數組並返回
	const returnTopics: Topic[] = [];
	for (const topicName in mapTopicToSubtopicSet) {
		const topic: Topic = { name: topicName, subtopics: [] };
		for (const subtopicName of mapTopicToSubtopicSet[topicName]!.keys()) {
			topic.subtopics.push({ name: subtopicName });
		}
		returnTopics.push(topic);
	}
	
	return returnTopics;
}
