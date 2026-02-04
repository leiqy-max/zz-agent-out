# Build stage
FROM node:18-alpine as build
WORKDIR /app

# 设置 npm 淘宝镜像加速 (可选，针对国内环境)
RUN npm config set registry https://registry.npmmirror.com

# 安装依赖
COPY package*.json ./
RUN npm install

# 构建应用
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
# 复制构建产物
COPY --from=build /app/dist /usr/share/nginx/html
# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
