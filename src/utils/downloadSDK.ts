/**
 * SDK下载工具函数
 * 用于将 dist/sdk 目录中的文件打包成 zip 并下载
 */

import JSZip from 'jszip';

/**
 * SDK基础文件列表（固定的文件名，不包含hash）
 * 这些文件应该在生产环境构建后存在
 * 注意：chunk文件包含hash，文件名是动态的，需要通过其他方式获取
 */
const SDK_BASE_FILES = [
  'index.js',
  'index.js.map',
  'index.cjs',
  'index.cjs.map',
  'index.global.js',
  'index.global.js.map',
  'index.d.ts',
  'index.d.cts',
];

/**
 * 下载单个文件
 * @param url 文件URL
 * @returns Promise<Blob | null> 返回Blob或null（如果文件不存在）
 */
async function fetchFile(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return null; // 文件不存在，返回null而不是抛出错误
      }
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.blob();
  } catch (error) {
    console.warn(`下载文件失败 ${url}:`, error);
    return null;
  }
}

/**
 * 尝试从后端API获取SDK文件列表
 * @returns Promise<string[] | null> 文件列表或null（如果API不存在）
 */
async function getSDKFileListFromAPI(): Promise<string[] | null> {
  try {
    const response = await fetch('/api/sdk/files');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.files || null;
  } catch (error) {
    return null;
  }
}

/**
 * 从index.js中提取chunk文件的引用
 * @param indexJsContent index.js的文件内容
 * @returns string[] chunk文件名列表
 */
function extractChunkFilesFromIndex(indexJsContent: string): string[] {
  const chunkFiles: string[] = [];
  
  // 匹配多种导入格式：
  // 1. import('xxx') 动态导入
  // 2. import xxx from 'xxx' 静态导入
  // 3. import('xxx') 或其他格式
  // 匹配 ./chunk-xxx.js 或 ./behavior-xxx.js 等格式（可能包含或不包含./前缀）
  const importRegex = /['"](\.\/)?([a-zA-Z0-9_-]+(?:chunk|behavior|error|http|performance)-[a-zA-Z0-9]+\.js)['"]/g;
  let match;
  
  while ((match = importRegex.exec(indexJsContent)) !== null) {
    const filename = match[2];
    // 只添加chunk文件（已经通过正则表达式过滤）
    if (filename && !chunkFiles.includes(filename)) {
      chunkFiles.push(filename);
    }
  }
  
  return chunkFiles;
}

/**
 * 通过读取index.js来发现所有依赖的文件
 * @returns Promise<string[]> 文件路径数组
 */
async function discoverSDKFiles(): Promise<string[]> {
  const discoveredFiles: string[] = [];

  // 首先下载基础文件
  const baseFilePromises = SDK_BASE_FILES.map(async (filename) => {
    const blob = await fetchFile(`/sdk/${filename}`);
    return blob ? filename : null;
  });

  const existingBaseFiles = (await Promise.all(baseFilePromises)).filter(
    (f): f is string => f !== null
  );
  discoveredFiles.push(...existingBaseFiles);

  // 尝试从index.js中提取chunk文件
  try {
    const indexJsBlob = await fetchFile('/sdk/index.js');
    if (indexJsBlob) {
      const indexJsContent = await indexJsBlob.text();
      const chunkFiles = extractChunkFilesFromIndex(indexJsContent);
      
      // 尝试下载这些chunk文件
      const chunkFilePromises = chunkFiles.map(async (filename) => {
        const blob = await fetchFile(`/sdk/${filename}`);
        if (blob) {
          const files = [filename];
          // 同时尝试下载对应的.map文件（如果存在）
          if (!filename.endsWith('.map')) {
            const mapFilename = `${filename}.map`;
            const mapBlob = await fetchFile(`/sdk/${mapFilename}`);
            if (mapBlob) {
              files.push(mapFilename);
            }
          }
          return files;
        }
        return null;
      });

      const chunkResults = await Promise.all(chunkFilePromises);
      chunkResults.forEach(chunks => {
        if (chunks) {
          discoveredFiles.push(...chunks);
        }
      });
    }
  } catch (error) {
    console.warn('无法从index.js提取chunk文件:', error);
  }
  
  return discoveredFiles;
}

/**
 * 下载SDK文件为ZIP压缩包
 * @param projectId 项目ID（可选，用于自定义文件名）
 */
export async function downloadSDKAsZip(projectId?: string): Promise<void> {
  try {
    const zip = new JSZip();
    const sdkFolder = zip.folder('sdk');
    
    if (!sdkFolder) {
      throw new Error('无法创建ZIP文件夹');
    }

    // 首先尝试从API获取文件列表
    let fileList = await getSDKFileListFromAPI();
    
    // 如果API不存在，尝试发现文件（包括从index.js提取chunk文件）
    if (!fileList || fileList.length === 0) {
      fileList = await discoverSDKFiles();
    }

    // 如果仍然没有文件，至少尝试下载基础文件
    if (!fileList || fileList.length === 0) {
      console.warn('无法自动发现所有文件，使用基础文件列表');
      // 只下载基础文件
      const baseFilePromises = SDK_BASE_FILES.map(async (filename) => {
        const blob = await fetchFile(`/sdk/${filename}`);
        return blob ? filename : null;
      });
      fileList = (await Promise.all(baseFilePromises)).filter(
        (f): f is string => f !== null
      );
    }

    if (!fileList || fileList.length === 0) {
      throw new Error('无法获取SDK文件列表，请确保SDK已构建并可通过 /sdk/ 路径访问');
    }

    // 并行下载所有文件
    const downloadResults = await Promise.allSettled(
      fileList.map(async (filename) => {
        const fileUrl = `/sdk/${filename}`;
        const blob = await fetchFile(fileUrl);
        if (blob) {
          sdkFolder.file(filename, blob);
          return { filename, success: true };
        }
        return { filename, success: false };
      })
    );

    // 统计成功和失败的文件
    const results = downloadResults.map((result, index) => 
      result.status === 'fulfilled' 
        ? result.value 
        : { filename: fileList![index], success: false }
    );
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    if (successCount === 0) {
      throw new Error('所有文件下载失败，请检查SDK文件是否存在且可访问');
    }

    if (failCount > 0) {
      console.warn(`部分文件下载失败 (${failCount}/${results.length})`);
      const failedFiles = results.filter(r => !r.success).map(r => r.filename);
      console.warn('失败的文件:', failedFiles);
    }

    console.log(`成功下载 ${successCount} 个文件`);

    // 生成ZIP文件
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6, // 压缩级别（0-9，6是平衡速度和压缩率的默认值）
      },
    });

    // 创建下载链接
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = projectId ? `sdk-${projectId}.zip` : 'sdk.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 释放URL对象
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('SDK下载完成');
  } catch (error) {
    console.error('下载SDK失败:', error);
    throw error;
  }
}

/**
 * 下载SDK文件（通过后端API，如果需要处理动态文件名）
 * 这个版本假设后端提供一个API来获取SDK文件列表或直接提供zip文件
 * @param projectId 项目ID
 */
export async function downloadSDKFromAPI(projectId?: string): Promise<void> {
  try {
    // 尝试从API下载（如果后端支持）
    const response = await fetch(`/api/sdk/download${projectId ? `?projectId=${projectId}` : ''}`);
    
    if (!response.ok) {
      // 如果API不存在，fallback到直接下载方式
      return downloadSDKAsZip(projectId);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = projectId ? `sdk-${projectId}.zip` : 'sdk.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } catch (error) {
    console.error('从API下载SDK失败，尝试直接下载:', error);
    // Fallback到直接下载方式
    return downloadSDKAsZip(projectId);
  }
}

