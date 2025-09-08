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
// This file contains CSV parsing utilities for sensemaker-backend
// 參考 sensemaking-tools/library/runner-cli/runner_openrouter_utils.ts 的實現
// Referenced implementation from sensemaking-tools/library/runner-cli/runner_openrouter_utils.ts

import { Comment, Topic, VoteTally } from 'sensemaking-tools';
import { convertCSV_new, CSVRow } from './csv_converter_new';

// 類型定義，參考 runner_openrouter_utils.ts
// Type definitions, referenced from runner_openrouter_utils.ts
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
  topics?: string; // 可以包含主題和子主題 / Can contain topics and subtopics
  topic?: string;
  subtopic?: string;
};

// 分組投票的鍵名格式
// Grouped voting key name format
export type VoteTallyGroupKey = `${string}-agree-count` | `${string}-disagree-count` | `${string}-pass-count`;

export interface VoteTallyCsvRow {
  [key: VoteTallyGroupKey]: number;
}

// 完整的 CSV 行類型
// Complete CSV row type
export type CommentCsvRow = VoteTallyCsvRow & CoreCommentCsvRow;

// CSV 格式類型
// CSV format types
export type CSVFormat = 'pol.is' | 'complete' | 'unknown';

// CSV 解析結果
// CSV parsing result
export interface CSVParseResult {
  headers: string[];
  rows: CSVRow[];
  format: CSVFormat;
  stats?: {
    totalVotes: number;
    passesCount: number;
    votesRange: { min: number; max: number };
  };
}

/**
 * 讀取 CSV 文件並返回原始數據
 * Read CSV file and return raw data
 */
export async function readCSVFile(file: File): Promise<{ headers: string[]; rows: CSVRow[] }> {
  const csvText = await file.text();
  const lines = csvText.trim().split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const dataLines = lines.slice(1);

  console.log('CSV Headers:', headers);
  console.log('Data lines count:', dataLines.length);

  const rows: CSVRow[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const values = line.split(',').map(v => v.trim());
    const row: CSVRow = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * 偵測 CSV 格式
 * Detect CSV format
 */
export function detectCSVFormat(headers: string[], rows: CSVRow[]): CSVFormat {
  console.log('Detecting CSV format...');
  console.log('Headers:', headers);
  
  // 優先檢查是否為完整格式（包含所有必要欄位）
  // Prioritize checking if it's complete format (contains all required columns)
  const completeRequiredColumns = ['comment-id', 'comment_text', 'agrees', 'disagrees', 'passes'];
  const hasCompleteColumns = completeRequiredColumns.every(col => headers.includes(col));
  
  if (hasCompleteColumns) {
    console.log('Detected complete format');
    return 'complete';
  }
  
  // 檢查是否為 pol.is 格式（必須包含這些欄位）
  // Check if it's pol.is format (must contain these columns)
  const polIsRequiredColumns = ['comment-id', 'agrees', 'disagrees', 'comment-body'];
  const hasPolIsColumns = polIsRequiredColumns.every(col => headers.includes(col));
  
  if (hasPolIsColumns) {
    console.log('Detected pol.is format');
    return 'pol.is';
  }
  
  // 檢查是否有 comment-body 欄位（可能是其他 pol.is 變體）
  // Check if there's comment-body column (might be other pol.is variant)
  if (headers.includes('comment-body')) {
    console.log('Detected pol.is variant format (with comment-body)');
    return 'pol.is';
  }
  
  console.log('Unknown format');
  return 'unknown';
}

/**
 * 根據格式解析 CSV 數據
 * Parse CSV data according to format
 */
export function parseCSVData(headers: string[], rows: CSVRow[], format: CSVFormat): CSVParseResult {
  console.log(`Parsing CSV data with format: ${format}`);
  
  if (format === 'pol.is') {
    // 使用 convertCSV_new 轉換 pol.is 格式
    // Use convertCSV_new to convert pol.is format
    console.log('Converting pol.is format using convertCSV_new...');
    const conversionResult = convertCSV_new(rows);
    
    if (!conversionResult.success) {
      throw new Error(`Failed to convert pol.is format: ${conversionResult.error}`);
    }
    
    console.log('Pol.is conversion successful');
    return {
      headers: conversionResult.fieldnames || headers,
      rows: conversionResult.rows || rows,
      format: 'complete', // 轉換後變成完整格式 / Converted to complete format
      stats: conversionResult.stats
    };
  } else if (format === 'complete') {
    // 完整格式，直接使用
    // Complete format, use directly
    console.log('Using complete format directly');
    return {
      headers,
      rows,
      format: 'complete'
    };
  } else {
    // 未知格式，嘗試基本解析
    // Unknown format, attempt basic parsing
    console.log('Unknown format, attempting basic parsing');
    return {
      headers,
      rows,
      format: 'unknown'
    };
  }
}

/**
 * 解析 CSV 文件，支持完整的 comments.csv 格式
 * Parse CSV file, supporting complete comments.csv format
 * 包括分組投票和主題信息
 * Including grouped voting and topic information
 */
export async function parseCSVFile(file: File): Promise<Comment[]> {
  // 1. 讀取 CSV 文件
  // 1. Read CSV file
  const { headers, rows } = await readCSVFile(file);
  
  // 2. 偵測 CSV 格式
  // 2. Detect CSV format
  const format = detectCSVFormat(headers, rows);
  
  // 3. 根據格式解析數據
  // 3. Parse data according to format
  const parseResult = parseCSVData(headers, rows, format);
  
  // 4. 將解析結果轉換為 Comment 物件
  // 4. Convert parsing result to Comment objects
  return convertToComments(parseResult.headers, parseResult.rows);
}

/**
 * 將解析後的 CSV 數據轉換為 Comment 物件陣列
 * Convert parsed CSV data to Comment object array
 */
function convertToComments(headers: string[], rows: CSVRow[]): Comment[] {
  console.log('Converting CSV rows to Comment objects...');
  console.log('Headers:', headers);
  
  // 查找必要的列
  // Find necessary columns
  const idIndex = headers.findIndex(h => h === 'comment-id' || h === 'id');
  const textIndex = headers.findIndex(h => h === 'comment_text' || h === 'text');
  
  console.log('Column indices:', { idIndex, textIndex });
  console.log('Column names:', { 
    idColumn: idIndex !== -1 ? headers[idIndex] : 'not found',
    textColumn: textIndex !== -1 ? headers[textIndex] : 'not found'
  });
  
  if (idIndex === -1 || textIndex === -1) {
    throw new Error('CSV must contain comment-id (or id) and comment_text (or text) columns');
  }

  // 查找投票相關列
  // Find voting-related columns
  const voteColumns = headers.filter(h => 
    h.includes('-agree-count') || 
    h.includes('-disagree-count') || 
    h.includes('-pass-count') ||
    h === 'agrees' || 
    h === 'disagrees' || 
    h === 'passes'
  );

  console.log('Vote columns found:', voteColumns);

  // 檢查是否有群組信息（必須包含 -agree-count 格式的欄位）
  // Check if there's group information (must contain -agree-count format columns)
  const hasGroupInfo = voteColumns.some(col => col.includes('-agree-count'));
  const hasSimpleVotes = voteColumns.some(col => ['agrees', 'disagrees', 'passes'].includes(col));
  
  console.log('Vote format detection:', {
    hasGroupInfo,
    hasSimpleVotes,
    voteColumns
  });
  
  // 提取群組名稱（如果存在群組信息）
  // Extract group names (if group information exists)
  const groupNames: string[] = [];
  if (hasGroupInfo) {
    const uniqueGroups = new Set(voteColumns.map(col => col.split('-')[0]));
    groupNames.push(...Array.from(uniqueGroups));
    console.log('Group names:', groupNames);
  }
  
  // 調試：檢查每個欄位的類型
  // Debug: Check each column type
  console.log('Column type analysis:');
  voteColumns.forEach(col => {
    const isGroup = col.includes('-agree-count');
    const isSimple = ['agrees', 'disagrees', 'passes'].includes(col);
    console.log(`  ${col}: group=${isGroup}, simple=${isSimple}`);
  });
  
  // 如果只有簡單投票欄位，確保 hasGroupInfo 為 false
  // If only simple voting columns exist, ensure hasGroupInfo is false
  if (!hasGroupInfo && hasSimpleVotes) {
    console.log('Only simple vote columns found, setting hasGroupInfo to false');
  }

  const comments: Comment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values = Object.values(row);
    
    console.log(`Processing line ${i + 1}:`, values);
    
    const comment: Comment = {
      id: row[headers[idIndex]] || `comment-${i}`,
      text: row[headers[textIndex]] || ''
    };

    // 處理投票信息
    // Process voting information
    if (voteColumns.length > 0) {
      try {
        // 優先檢查簡單投票格式: agrees, disagrees, passes
        // Prioritize checking simple voting format: agrees, disagrees, passes
        if (hasSimpleVotes) {
          const agreesIndex = headers.findIndex(h => h === 'agrees');
          const disagreesIndex = headers.findIndex(h => h === 'disagrees');
          const passesIndex = headers.findIndex(h => h === 'passes');
          
          if (agreesIndex !== -1 && disagreesIndex !== -1) {
            const agrees = parseInt(row[headers[agreesIndex]]) || 0;
            const disagrees = parseInt(row[headers[disagreesIndex]]) || 0;
            const passes = passesIndex !== -1 ? (parseInt(row[headers[passesIndex]]) || 0) : 0;
            
            console.log('Creating simple VoteTally:', { agrees, disagrees, passes });
            
            try {
              comment.voteInfo = new VoteTally(agrees, disagrees, passes);
              console.log('Simple VoteTally created successfully:', comment.voteInfo);
            } catch (error) {
              console.error('Error creating simple VoteTally:', error);
              // 如果 VoteTally 創建失敗，使用普通對象
              // If VoteTally creation fails, use plain object
              comment.voteInfo = {
                agreeCount: agrees,
                disagreeCount: disagrees,
                passCount: passes,
                getTotalCount: (includePasses: boolean) => {
                  if (includePasses) {
                    return agrees + disagrees + passes;
                  } else {
                    return agrees + disagrees;
                  }
                }
              } as any;
            }
          }
        } else if (hasGroupInfo && groupNames.length > 0) {
          // 群組投票格式: {group name}-agree-count, {group name}-disagree-count, {group name}-pass-count
          // Group voting format: {group name}-agree-count, {group name}-disagree-count, {group name}-pass-count
          const voteInfo: { [key: string]: VoteTally } = {};
          
          groupNames.forEach(group => {
            const agreeCol = headers.findIndex(h => h === `${group}-agree-count`);
            const disagreeCol = headers.findIndex(h => h === `${group}-disagree-count`);
            const passCol = headers.findIndex(h => h === `${group}-pass-count`);
            
            if (agreeCol !== -1 && disagreeCol !== -1) {
              const agreeCount = parseInt(row[headers[agreeCol]]) || 0;
              const disagreeCount = parseInt(row[headers[disagreeCol]]) || 0;
              const passCount = passCol !== -1 ? (parseInt(row[headers[passCol]]) || 0) : 0;
              
              console.log(`Creating VoteTally for group ${group}:`, { agreeCount, disagreeCount, passCount });
              
              try {
                voteInfo[group] = new VoteTally(agreeCount, disagreeCount, passCount);
                console.log(`VoteTally created successfully for group ${group}:`, voteInfo[group]);
              } catch (error) {
                console.error(`Error creating VoteTally for group ${group}:`, error);
                // 如果 VoteTally 創建失敗，使用普通對象
                // If VoteTally creation fails, use plain object
                voteInfo[group] = {
                  agreeCount,
                  disagreeCount,
                  passCount,
                  getTotalCount: (includePasses: boolean) => {
                    if (includePasses) {
                      return agreeCount + disagreeCount + passCount;
                    } else {
                      return agreeCount + disagreeCount;
                    }
                  }
                } as any;
              }
            }
          });
          
          if (Object.keys(voteInfo).length > 0) {
            comment.voteInfo = voteInfo;
          }
        }
      } catch (error) {
        console.error('Error processing vote information:', error);
      }
    }

         // 處理主題信息（如果存在）- 存儲在 metadata 中
         // Process topic information (if exists) - stored in metadata
     const topicsIndex = headers.findIndex(h => h === 'topics');
     const topicIndex = headers.findIndex(h => h === 'topic');
     const subtopicIndex = headers.findIndex(h => h === 'subtopic');
     
     if (topicsIndex !== -1 && row[headers[topicsIndex]]) {
       // 解析主題字符串並存儲在 metadata 中
       // Parse topic string and store in metadata
       const topics = parseTopicsString(row[headers[topicsIndex]]);
       if (topics.length > 0) {
         comment.metadata = { ...comment.metadata, topics };
       }
     } else if (topicIndex !== -1 && row[headers[topicIndex]]) {
       // 單個主題和子主題
       // Single topic and subtopic
       const topic = {
         name: row[headers[topicIndex]],
         subtopics: subtopicIndex !== -1 && row[headers[subtopicIndex]] ? 
           [{ name: row[headers[subtopicIndex]] }] : []
       };
       comment.metadata = { ...comment.metadata, topics: [topic] };
     }

    comments.push(comment);
    console.log(`Comment ${i + 1} created:`, comment);
  }

  console.log('Total comments created:', comments.length);
  return comments;
}

/**
 * 從 CSV 行獲取投票信息
 * Get voting information from CSV row
 */
export function getVoteInfoFromCsvRow(
	row: CommentCsvRow,
	usesGroups: boolean,
	groupNames: string[]
): any {
	if (usesGroups) {
		// 分組投票格式
		// Grouped voting format
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
		// Simple voting format
		return new VoteTally(
			Number(row.agrees || 0), 
			Number(row.disagrees || 0), 
			Number(row.passes || 0)
		);
	}
}

/**
 * 解析主題字符串，支持嵌套主題格式
 * Parse topic string, supporting nested topic format
 * 例如: "Education,Technology" 或 "Education:Math,Science:Physics"
 * For example: "Education,Technology" or "Education:Math,Science:Physics"
 */
export function parseTopicsString(topicsString: string): Topic[] {
	if (!topicsString || topicsString.trim() === '') {
		return [];
	}

	// 移除引號
	// Remove quotes
	const cleanString = topicsString.replace(/^["']|["']$/g, '');
	
	// 分割主題（支持逗號分隔）
	// Split topics (supports comma separation)
	const topicParts = cleanString.split(',').map(t => t.trim()).filter(t => t);
	
	return topicParts.map(topicName => ({
		id: topicName.toLowerCase().replace(/\s+/g, '-'), // 生成 ID / Generate ID
		name: topicName,
		subtopics: []
	}));
}
