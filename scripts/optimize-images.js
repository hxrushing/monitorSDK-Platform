/**
 * 图片优化脚本
 * 将 PNG 图片转换为 WebP 格式并调整尺寸
 * 
 * 使用方法：
 * 1. 安装依赖：npm install sharp
 * 2. 运行脚本：node scripts/optimize-images.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../src/assets');
const IMAGES = [
  { name: 'logo1.jpg', sizes: [{ width: 48, suffix: '48' }] },
  { name: 'logo2.jpg', sizes: [{ width: 160, suffix: '160' }, { width: 48, suffix: '48' }] }
];

async function optimizeImage(imageName, sizes) {
  const inputPath = path.join(ASSETS_DIR, imageName);
  
  // 检查文件是否存在
  if (!fs.existsSync(inputPath)) {
    console.warn(`文件不存在: ${imageName}`);
    return;
  }

  // 获取原始图片信息
  const metadata = await sharp(inputPath).metadata();
  console.log(`\n处理图片: ${imageName}`);
  console.log(`原始尺寸: ${metadata.width}x${metadata.height}`);
  console.log(`原始大小: ${(fs.statSync(inputPath).size / 1024).toFixed(2)} KB`);

  // 为每个尺寸生成 WebP 版本
  for (const size of sizes) {
    const outputName = imageName.replace(/\.(png|jpg|jpeg)$/i, `-${size.suffix}.webp`);
    const outputPath = path.join(ASSETS_DIR, outputName);
    
    try {
      await sharp(inputPath)
        .resize(size.width, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 85 })
        .toFile(outputPath);
      
      const outputSize = fs.statSync(outputPath).size;
      const reduction = ((1 - outputSize / fs.statSync(inputPath).size) * 100).toFixed(1);
      
      console.log(`  ✓ ${outputName}: ${(outputSize / 1024).toFixed(2)} KB (减少 ${reduction}%)`);
    } catch (error) {
      console.error(`  ✗ 生成 ${outputName} 失败:`, error.message);
    }
  }
}

async function main() {
  console.log('开始优化图片...\n');
  console.log('='.repeat(50));

  // 检查 sharp 是否安装
  try {
    require.resolve('sharp');
  } catch (error) {
    console.error('错误: 未安装 sharp 模块');
    console.log('请运行: npm install sharp');
    process.exit(1);
  }

  // 处理所有图片
  for (const image of IMAGES) {
    await optimizeImage(image.name, image.sizes);
  }

  console.log('\n' + '='.repeat(50));
  console.log('图片优化完成！');
  console.log('\n提示:');
  console.log('- WebP 文件已生成，可以在代码中使用');
  console.log('- 原始图片文件保留作为回退方案');
  console.log('- 建议在构建时自动运行此脚本');
}

main().catch(error => {
  console.error('优化失败:', error);
  process.exit(1);
});

