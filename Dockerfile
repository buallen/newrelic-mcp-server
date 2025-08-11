# 多阶段构建 Dockerfile
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖 (包括开发依赖)
RUN npm ci

# 复制源代码
COPY src/ ./src/
COPY tests/ ./tests/

# 构建应用
RUN npm run build

# 运行测试 (可选)
RUN npm test

# 生产阶段
FROM node:20-alpine AS production

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 从构建阶段复制编译后的代码
COPY --from=builder /app/dist ./dist

# 创建日志目录
RUN mkdir -p logs && chown -R nextjs:nodejs logs

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000 9090

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "dist/index.js"]