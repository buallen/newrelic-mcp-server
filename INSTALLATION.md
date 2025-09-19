# NewRelic MCP Server 安装教程

## 概述

NewRelic MCP Server 是一个功能完整的 Model Context Protocol (MCP) 服务器，为 AI 代理提供与 NewRelic 监控平台的集成能力。本教程将指导您完成从环境准备到生产部署的完整安装过程。

## 系统要求

### 最低要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **内存**: 最少 512MB RAM
- **存储**: 最少 1GB 可用空间
- **操作系统**: macOS, Linux, 或 Windows

### 推荐配置

- **Node.js**: 20.0.0 或更高版本
- **内存**: 2GB RAM 或更多
- **存储**: 5GB 可用空间
- **CPU**: 2核心或更多

### 依赖服务

- **NewRelic 账户**: 需要有效的 NewRelic 账户和 API 密钥
- **Redis** (可选): 用于分布式缓存
- **Docker** (可选): 用于容器化部署

## 快速开始

### 1. 克隆项目

```bash
# 克隆项目到本地
git clone <repository-url>
cd newrelic-mcp-server

# 或者如果您已经有项目文件
cd newrelic-mcp-server
```

### 2. 安装依赖

```bash
# 安装项目依赖
npm install

# 或使用 yarn
yarn install
```

### 3. 环境配置

创建环境配置文件：

```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件
nano .env
```

基本环境变量配置：

```bash
# NewRelic 配置 (必需)
NEWRELIC_API_KEY=your_newrelic_api_key_here
NEWRELIC_ACCOUNT_ID=your_account_id

# 服务器配置 (可选)
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost

# 日志配置 (可选)
LOG_LEVEL=info
LOG_FORMAT=json

# 缓存配置 (可选)
CACHE_TYPE=memory
CACHE_TTL=300

# 性能监控 (可选)
ENABLE_METRICS=true
METRICS_PORT=9090
```

### 4. 构建项目

```bash
# 编译 TypeScript 代码
npm run build

# 或者开发模式
npm run dev
```

### 5. 启动服务

```bash
# 生产模式启动
npm start

# 或开发模式启动
npm run dev
```

服务启动后，您应该看到类似以下的输出：

```
[INFO] NewRelic MCP Server starting...
[INFO] Server listening on http://localhost:3000
[INFO] Health check endpoint: http://localhost:3000/health
[INFO] Metrics endpoint: http://localhost:9090/metrics
```

## 详细安装步骤

### 步骤 1: 环境准备

#### 1.1 安装 Node.js

**macOS (使用 Homebrew):**

```bash
brew install node@20
```

**Ubuntu/Debian:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
从 [Node.js 官网](https://nodejs.org/) 下载并安装最新的 LTS 版本。

#### 1.2 验证安装

```bash
node --version  # 应该显示 v18.0.0 或更高
npm --version   # 应该显示 8.0.0 或更高
```

### 步骤 2: 获取 NewRelic API 密钥

1. 登录您的 [NewRelic 账户](https://one.newrelic.com/)
2. 导航到 **API Keys** 页面
3. 创建一个新的 **User API Key**
4. 复制生成的 API 密钥
5. 记录您的账户 ID (可在账户设置中找到)

### 步骤 3: 项目配置

#### 3.1 创建配置文件

创建 `.env` 文件：

```bash
# NewRelic 集成配置
NEWRELIC_API_KEY=NRAK-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEWRELIC_ACCOUNT_ID=1234567
NEWRELIC_BASE_URL=https://api.newrelic.com
NEWRELIC_GRAPHQL_URL=https://api.newrelic.com/graphql

# 服务器配置
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=0.0.0.0
MCP_SERVER_TIMEOUT=30000

# 缓存配置
CACHE_TYPE=memory
CACHE_TTL=300
CACHE_MAX_SIZE=1000

# Redis 配置 (如果使用 Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=console

# 性能监控
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# 安全配置
ENABLE_CORS=true
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=1000

# 开发配置
NODE_ENV=production
```

#### 3.2 高级配置选项

创建 `config/production.json` 用于生产环境配置：

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "timeout": 30000,
    "keepAliveTimeout": 5000
  },
  "newrelic": {
    "timeout": 30000,
    "retryAttempts": 3,
    "rateLimitPerMinute": 1000
  },
  "cache": {
    "type": "redis",
    "ttl": 300,
    "maxSize": 10000,
    "redis": {
      "host": "localhost",
      "port": 6379,
      "maxRetriesPerRequest": 3
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "destination": "file",
    "maxFiles": 5,
    "maxSize": "10m"
  },
  "monitoring": {
    "enabled": true,
    "metricsPort": 9090,
    "healthCheckInterval": 30000
  }
}
```

### 步骤 4: 验证安装

#### 4.1 运行健康检查

```bash
# 启动服务
npm start

# 在另一个终端中测试健康检查
curl http://localhost:3000/health
```

预期响应：

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "checks": [
    {
      "name": "newrelic_api",
      "status": "pass",
      "message": "NewRelic API connection successful"
    },
    {
      "name": "cache",
      "status": "pass",
      "message": "Cache system operational"
    }
  ]
}
```

#### 4.2 测试 MCP 连接

```bash
# 测试 MCP 协议端点
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

预期响应：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "nrql_query",
        "description": "Execute NRQL queries against NewRelic",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "NRQL query to execute"
            }
          }
        }
      }
    ]
  }
}
```

#### 4.3 运行测试套件

```bash
# 运行单元测试
npm test

# 运行集成测试 (需要有效的 API 密钥)
npm run test:integration

# 运行性能测试
npm run test:performance

# 生成测试覆盖率报告
npm run test:coverage
```

## 部署选项

### 选项 1: 直接部署

适用于开发和小规模生产环境：

```bash
# 安装 PM2 进程管理器
npm install -g pm2

# 使用 PM2 启动服务
pm2 start ecosystem.config.js

# 查看服务状态
pm2 status

# 查看日志
pm2 logs newrelic-mcp-server
```

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'newrelic-mcp-server',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
```

### 选项 2: Docker 部署

#### 2.1 构建 Docker 镜像

```bash
# 构建镜像
docker build -t newrelic-mcp-server:latest .

# 运行容器
docker run -d \
  --name newrelic-mcp-server \
  -p 3000:3000 \
  -p 9090:9090 \
  -e NEWRELIC_API_KEY=your_api_key \
  -e NEWRELIC_ACCOUNT_ID=your_account_id \
  newrelic-mcp-server:latest
```

#### 2.2 使用 Docker Compose

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  newrelic-mcp-server:
    build: .
    ports:
      - '3000:3000'
      - '9090:9090'
    environment:
      - NEWRELIC_API_KEY=${NEWRELIC_API_KEY}
      - NEWRELIC_ACCOUNT_ID=${NEWRELIC_ACCOUNT_ID}
      - CACHE_TYPE=redis
      - REDIS_HOST=redis
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

启动服务：

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f newrelic-mcp-server
```

### 选项 3: Kubernetes 部署

#### 3.1 创建配置文件

创建 `k8s/configmap.yaml`：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: newrelic-mcp-config
data:
  LOG_LEVEL: 'info'
  CACHE_TYPE: 'redis'
  REDIS_HOST: 'redis-service'
  ENABLE_METRICS: 'true'
```

创建 `k8s/secret.yaml`：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: newrelic-mcp-secrets
type: Opaque
data:
  NEWRELIC_API_KEY: <base64-encoded-api-key>
  NEWRELIC_ACCOUNT_ID: <base64-encoded-account-id>
```

创建 `k8s/deployment.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: newrelic-mcp-server
  labels:
    app: newrelic-mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: newrelic-mcp-server
  template:
    metadata:
      labels:
        app: newrelic-mcp-server
    spec:
      containers:
        - name: newrelic-mcp-server
          image: newrelic-mcp-server:latest
          ports:
            - containerPort: 3000
            - containerPort: 9090
          envFrom:
            - configMapRef:
                name: newrelic-mcp-config
            - secretRef:
                name: newrelic-mcp-secrets
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

创建 `k8s/service.yaml`：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: newrelic-mcp-service
spec:
  selector:
    app: newrelic-mcp-server
  ports:
    - name: http
      port: 80
      targetPort: 3000
    - name: metrics
      port: 9090
      targetPort: 9090
  type: LoadBalancer
```

#### 3.2 部署到 Kubernetes

```bash
# 创建命名空间
kubectl create namespace newrelic-mcp

# 应用配置
kubectl apply -f k8s/ -n newrelic-mcp

# 查看部署状态
kubectl get pods -n newrelic-mcp

# 查看服务
kubectl get services -n newrelic-mcp

# 查看日志
kubectl logs -f deployment/newrelic-mcp-server -n newrelic-mcp
```

## 监控和维护

### 监控指标

服务提供多个监控端点：

```bash
# 健康检查
curl http://localhost:3000/health

# Prometheus 指标
curl http://localhost:9090/metrics

# 性能统计
curl http://localhost:3000/stats
```

### 日志管理

日志配置选项：

```bash
# 设置日志级别
export LOG_LEVEL=debug

# 设置日志格式
export LOG_FORMAT=json

# 设置日志输出
export LOG_DESTINATION=file
```

### 性能调优

#### 内存优化

```bash
# 增加 Node.js 堆内存
export NODE_OPTIONS="--max-old-space-size=2048"

# 启用垃圾回收日志
export NODE_OPTIONS="--trace-gc"
```

#### 缓存优化

```bash
# 使用 Redis 缓存
export CACHE_TYPE=redis
export REDIS_HOST=localhost
export REDIS_PORT=6379

# 调整缓存 TTL
export CACHE_TTL=600
```

## 故障排除

### 常见问题

#### 1. API 连接失败

**症状**: 服务启动时显示 NewRelic API 连接错误

**解决方案**:

```bash
# 验证 API 密钥
curl -H "Api-Key: YOUR_API_KEY" \
     https://api.newrelic.com/v2/applications.json

# 检查网络连接
ping api.newrelic.com

# 验证环境变量
echo $NEWRELIC_API_KEY
echo $NEWRELIC_ACCOUNT_ID
```

#### 2. 内存不足

**症状**: 服务频繁重启或响应缓慢

**解决方案**:

```bash
# 增加内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 启用内存监控
export ENABLE_MEMORY_MONITORING=true

# 调整缓存大小
export CACHE_MAX_SIZE=500
```

#### 3. 端口冲突

**症状**: 服务无法启动，提示端口被占用

**解决方案**:

```bash
# 查找占用端口的进程
lsof -i :3000

# 更改服务端口
export MCP_SERVER_PORT=3001

# 或终止占用端口的进程
kill -9 <PID>
```

### 调试模式

启用调试模式获取详细日志：

```bash
# 设置调试级别
export LOG_LEVEL=debug
export DEBUG=newrelic-mcp:*

# 启动服务
npm run dev
```

### 性能分析

```bash
# 启用性能分析
export NODE_OPTIONS="--prof"

# 运行服务一段时间后生成报告
node --prof-process isolate-*.log > profile.txt
```

## 安全考虑

### API 密钥安全

1. **永远不要**将 API 密钥提交到版本控制系统
2. 使用环境变量或安全的密钥管理系统
3. 定期轮换 API 密钥
4. 限制 API 密钥的权限范围

### 网络安全

```bash
# 启用 HTTPS (生产环境)
export ENABLE_HTTPS=true
export SSL_CERT_PATH=/path/to/cert.pem
export SSL_KEY_PATH=/path/to/key.pem

# 配置 CORS
export CORS_ORIGIN=https://your-domain.com

# 启用速率限制
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_MAX=1000
```

### 访问控制

```bash
# 启用认证
export ENABLE_AUTH=true
export AUTH_SECRET=your-secret-key

# 配置 IP 白名单
export ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
```

## 升级指南

### 版本升级

```bash
# 备份当前配置
cp .env .env.backup

# 拉取最新代码
git pull origin main

# 安装新依赖
npm install

# 运行数据库迁移 (如果需要)
npm run migrate

# 重新构建
npm run build

# 重启服务
pm2 restart newrelic-mcp-server
```

### 配置迁移

检查新版本的配置变更：

```bash
# 比较配置文件
diff .env.example .env

# 更新配置
nano .env
```

## 支持和帮助

### 获取帮助

1. **文档**: 查看 `docs/` 目录中的详细文档
2. **API 参考**: 访问 `http://localhost:3000/docs` 查看 API 文档
3. **日志分析**: 检查应用日志获取错误信息
4. **健康检查**: 使用 `/health` 端点诊断问题

### 报告问题

提交问题时请包含：

1. 错误消息和堆栈跟踪
2. 环境配置信息
3. 重现步骤
4. 系统信息 (OS, Node.js 版本等)

### 性能监控

建议设置以下监控：

1. **应用性能**: 响应时间、吞吐量、错误率
2. **系统资源**: CPU、内存、磁盘使用率
3. **外部依赖**: NewRelic API 响应时间
4. **业务指标**: 查询成功率、缓存命中率

---

## 总结

本安装教程涵盖了从基本安装到生产部署的完整流程。根据您的具体需求选择合适的部署方式：

- **开发环境**: 使用直接安装方式
- **小规模生产**: 使用 PM2 进程管理
- **容器化部署**: 使用 Docker 或 Docker Compose
- **大规模生产**: 使用 Kubernetes 集群部署

记住定期更新依赖、监控系统性能，并遵循安全最佳实践。如果遇到问题，请参考故障排除部分或查看详细的日志信息。
