#!/bin/bash

echo "=== PM2 环境变量检查 ==="
echo ""

# 检查 PM2 进程的环境变量
echo "1. 检查 PM2 进程的环境变量:"
pm2 show analytics-api | grep -A 50 "env:" || echo "   PM2 进程不存在或无法获取环境变量"

echo ""
echo "2. 检查 PM2 启动脚本:"
pm2 show analytics-api | grep -E "(script|exec_mode|cwd|interpreter)" || echo "   无法获取启动信息"

echo ""
echo "3. 检查是否有 PM2 ecosystem 配置文件:"
find /www/wwwroot/default -name "ecosystem*.js" -o -name "ecosystem*.json" -o -name "pm2*.json" 2>/dev/null

echo ""
echo "4. 检查 PM2 保存的配置:"
pm2 save --force 2>&1 | head -5

echo ""
echo "5. 检查系统环境变量中的 DB_HOST:"
echo "   DB_HOST: ${DB_HOST:-未设置}"

echo ""
echo "6. 检查 .env 文件位置和内容:"
if [ -f "/www/wwwroot/default/server/.env" ]; then
  echo "   .env 文件存在"
  echo "   DB_HOST 值: $(grep '^DB_HOST=' /www/wwwroot/default/server/.env | cut -d'=' -f2)"
else
  echo "   .env 文件不存在"
fi

echo ""
echo "=== 检查完成 ==="

