import type { Comment } from 'sensemaking-tools';

/**
 * 偵測是否為 Polis.tw 格式的 JSON
 */
function detectPolisTW(data: any): boolean {
	if (!Array.isArray(data) || data.length === 0) return false;
	
	const firstItem = data[0];
	return (
		typeof firstItem === 'object' &&
		firstItem !== null &&
		'txt' in firstItem &&
		'tid' in firstItem &&
		'agree_count' in firstItem &&
		'disagree_count' in firstItem &&
		'pass_count' in firstItem &&
		'count' in firstItem
	);
}

/**
 * 將 Polis.tw 格式轉換為 Sensemaker 格式
 */
function convertPolisTWToSensemaker(polisData: any[]): Comment[] {
	return polisData.map((item, index) => ({
		id: item.tid?.toString() || `polis-${index}`,
		text: item.txt || '',
		voteInfo: {
			agreeCount: parseInt(item.agree_count) || 0,
			disagreeCount: parseInt(item.disagree_count) || 0,
			passCount: parseInt(item.pass_count) || 0,
			getTotalCount: (includePass: boolean = true) => {
				const agree = parseInt(item.agree_count) || 0;
				const disagree = parseInt(item.disagree_count) || 0;
				const pass = parseInt(item.pass_count) || 0;
				return agree + disagree + (includePass ? pass : 0);
			}
		},
		topics: item.topics || undefined
	}));
}

/**
 * 解析 JSON 文件
 */
export async function parseJSONFile(file: File): Promise<Comment[]> {
	const jsonText = await file.text();
	const jsonData = JSON.parse(jsonText);
	
	if (Array.isArray(jsonData)) {
		// 檢查是否為 Polis.tw 格式
		if (detectPolisTW(jsonData)) {
			console.log('Detected Polis.tw format, converting to Sensemaker format...');
			return convertPolisTWToSensemaker(jsonData);
		}
		
		// 標準格式處理
		return jsonData.map((item, index) => ({
			id: item.id || `comment-${index}`,
			text: item.text || item.comment_text || '',
			voteInfo: item.voteInfo || item.votes || undefined,
			topics: item.topics || undefined
		}));
	} else if (jsonData.comments && Array.isArray(jsonData.comments)) {
		// 檢查是否為 Polis.tw 格式
		if (detectPolisTW(jsonData.comments)) {
			console.log('Detected Polis.tw format in comments array, converting to Sensemaker format...');
			return convertPolisTWToSensemaker(jsonData.comments);
		}
		
		// 標準格式處理
		return jsonData.comments.map((item: any, index: number) => ({
			id: item.id || `comment-${index}`,
			text: item.text || item.comment_text || '',
			voteInfo: item.voteInfo || item.votes || undefined,
			topics: item.topics || undefined
		}));
	} else {
		throw new Error('Invalid JSON format: expected array of comments or object with comments array');
	}
}
