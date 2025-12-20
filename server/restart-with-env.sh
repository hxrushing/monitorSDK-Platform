#!/bin/bash

# PM2 重启脚本 - 强制更新环境变量

echo "正在停止 PM2 服务..."
pm2 stop analytics-api

echo "等待 2 秒..."
sleep 2

echo "删除 PM2 进程..."
pm2 delete analytics-api

echo "等待 1 秒..."
sleep 1

echo "重新启动服务（从 .env 读取环境变量）..."
cd /www/wwwroot/default/server
pm2 start dist/app.js --name analytics-api --update-env

echo "等待服务启动..."
sleep 2

echo "查看服务状态..."
pm2 status

echo ""
echo "查看最新日志（最后 20 行）..."
pm2 logs analytics-api --lines 20 --nostream

