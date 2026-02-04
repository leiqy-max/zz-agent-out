# Ops Agent 接入 NC 框架指南

本文档详细说明如何将 Ops Agent 智能问答系统作为子模块，无缝并入现有的 NC 框架（基于 Spring Cloud + Nacos 的企业级架构）。

## 1. 适配原理

虽然 Ops Agent 是基于 Python 和 React 的异构应用，但我们通过以下方式实现了与 NC 框架的标准化对接：

*   **目录结构伪装**：提供了 `pom.xml` 和 `build.sh`，使其在 CI/CD 流水线中看起来像一个标准的 Java 模块。
*   **服务注册 (Nacos)**：Python 后端通过 `nacos-sdk-python` 主动注册到 NC 的 Nacos 中心，实现服务发现。
*   **前端集成**：前端构建路径已调整为 `/ops-agent-ui/`，可直接部署在 NC 的 Nginx 统一网关下。

## 2. 接入步骤

### 2.1 构建 (CI/CD)
在 NC 框架的构建流水线中，直接执行项目根目录下的构建脚本：
```bash
bash build.sh
```
该脚本会自动：
1.  构建前端静态资源 (输出到 `frontend/dist`)。
2.  构建后端 Docker 镜像 (`ops-agent-backend:latest`)。

### 2.2 部署配置 (Environment Variables)
在部署后端容器时，**必须**注入以下环境变量以连接 NC 的基础设施：

| 变量名 | 必填 | 说明 | 示例值 |
| :--- | :--- | :--- | :--- |
| `NACOS_ADDR` | 是 | NC 框架的 Nacos 地址 | `192.168.50.249:8848` |
| `NACOS_NAMESPACE` | 否 | Nacos 命名空间 ID | `public` |
| `NACOS_SERVICE_NAME` | 否 | 注册到 Nacos 的服务名 | `ops-agent-biz` |
| `NACOS_GROUP` | 否 | Nacos 分组 | `DEFAULT_GROUP` |
| `HOST_IP` | 是 | 当前容器/Pod 的 IP (供 Nacos 回调) | (K8s Downward API) |
| `PORT` | 否 | 服务监听端口 | `8000` |
| `DB_HOST` | 是 | NC 共享数据库地址 | `192.168.50.249` |

### 2.3 网关路由配置 (Nginx/Gateway)
请在 NC 框架的统一网关（如 Spring Cloud Gateway 或 Nginx）中添加路由规则：

#### Nginx 配置示例：
```nginx
# 1. 前端页面路由
location /ops-agent-ui/ {
    alias /usr/share/nginx/html/ops-agent-frontend/;
    index index.html;
    try_files $uri $uri/ /ops-agent-ui/index.html;
}

# 2. 后端 API 路由 (转发到 ops-agent-biz 服务)
location /api/ops-agent/ {
    # 如果使用 Nginx 负载均衡
    proxy_pass http://ops-agent-backend:8000/;
    
    # 如果使用 Spring Cloud Gateway，则由 Gateway 自动根据服务名转发
}
```

### 2.4 菜单接入
在 NC 门户的“菜单管理”中添加新菜单：
*   **菜单名称**：智能运维助手
*   **链接地址**：`/ops-agent-ui/`
*   **打开方式**：内部窗口 (IFrame) 或 新窗口

## 3. 验证检查点
1.  **Nacos 控制台**：登录 NC 的 Nacos 控制台，查看是否有名为 `ops-agent-biz` 的服务上线，且健康状态为 `true`。
2.  **页面访问**：访问 `http://门户IP/ops-agent-ui/`，应能看到登录界面。
