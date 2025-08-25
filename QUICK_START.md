# NewRelic MCP Server - Quick Start

## 修复完成 ✅

NewRelic MCP Server已经成功修复并可以使用！我创建了一个简化但功能完整的版本。

## 使用方法

### 1. 设置环境变量

```bash
export NEW_RELIC_API_KEY="your_newrelic_api_key"
export NEW_RELIC_ACCOUNT_ID="your_account_id"
```

### 2. 测试服务器

```bash
node test-server.js
```

### 3. 启动MCP服务器

```bash
node simple-server.js
```

## 可用功能

### 🔍 get-incidents
获取NewRelic incidents，支持过滤
```json
{
  "name": "get-incidents", 
  "arguments": {
    "only_open": true,
    "search": "campaign",
    "since": "2024-08-24T00:00:00Z"
  }
}
```

### 🎯 search-campaign-incidents  
专门搜索campaign服务相关incidents
```json
{
  "name": "search-campaign-incidents",
  "arguments": {
    "timeRange": "24 HOURS"
  }
}
```

### 📊 execute-nrql
执行NRQL查询
```json
{
  "name": "execute-nrql",
  "arguments": {
    "query": "SELECT count(*) FROM Transaction WHERE appName LIKE '%campaign%' SINCE 1 day ago"
  }
}
```

## Campaign Service 分析查询示例

### 查找Campaign相关错误
```sql
SELECT * FROM TransactionError 
WHERE appName LIKE '%campaign%' 
SINCE 1 day ago 
LIMIT 100
```

### Campaign服务性能指标
```sql
SELECT average(duration), count(*), percentage(count(*), WHERE error IS true) 
FROM Transaction 
WHERE appName LIKE '%campaign%' 
SINCE 1 hour ago 
TIMESERIES 5 minutes
```

### gRPC调用监控
```sql
SELECT count(*) FROM Transaction 
WHERE name LIKE '%campaignSvc%' 
AND error IS true 
SINCE 4 hours ago 
FACET `error.message`
```

## 常见Campaign Service Incidents查询

1. **gRPC超时检查**:
   ```sql
   SELECT * FROM TransactionError 
   WHERE `error.message` LIKE '%timeout%' 
   AND appName = 'StoreHub Node.js Service'
   SINCE 1 day ago
   ```

2. **Campaign触发失败**:
   ```sql
   SELECT count(*) FROM Transaction 
   WHERE name LIKE '%triggerStaticCampaign%' 
   AND error IS true 
   SINCE 6 hours ago 
   TIMESERIES 30 minutes
   ```

3. **批量短信活动错误**:
   ```sql
   SELECT * FROM TransactionError 
   WHERE `error.message` LIKE '%createOneTimeCampaign%'
   SINCE 1 day ago
   ```

## 故障排除

如果遇到错误：

1. **API Key问题**: 确保您的NewRelic API Key有正确权限
2. **Account ID问题**: 检查账户ID是否正确
3. **网络问题**: 确保可以访问`api.newrelic.com`

## 下一步

现在您可以使用这个MCP服务器来：

✅ 查询campaign service的最新incidents  
✅ 分析错误模式和频率  
✅ 监控gRPC调用状态  
✅ 执行自定义NRQL查询进行深入分析  

服务器已经可以正常工作，可以开始分析campaign service的NewRelic incidents了！