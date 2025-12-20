#!/bin/bash

echo "=== PM2 重启脚本（使用 ecosystem 配置）==="
echo ""

cd /www/wwwroot/default/server

echo "1. 停止并删除旧进程..."
pm2 stop analytics-api 2>/dev/null
pm2 delete analytics-api 2>/dev/null

echo ""
echo "2. 等待 2 秒..."
sleep 2

echo ""
echo "3. 使用 ecosystem 配置启动服务..."
if [ -f "ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js
else
  echo "   ⚠️  ecosystem.config.js 不存在，使用默认方式启动"
  pm2 start dist/app.js --name analytics-api --env-file .env
fi

echo ""
echo "4. 等待服务启动..."
sleep 3

echo ""
echo "5. 查看服务状态..."
pm2 status

echo ""
echo "6. 查看最新日志（最后 30 行）..."
pm2 logs analytics-api --lines 30 --nostream

echo ""
echo "=== 重启完成 ==="
echo ""
echo "如果问题仍然存在，请检查："
echo "  1. .env 文件中的 DB_HOST 是否为 127.0.0.1"
echo "  2. 日志中显示的环境变量是否正确"
echo "  3. 是否有其他进程在使用旧的配置"

