# 本地开发

## 环境

- 建议使用 JDK 8（源码目标为 Java 8；Gradle wrapper 为旧版 5.6.2，在较新 JDK 上可能无法运行）
- MySQL 8；`financial.sql` 是 MySQL dump
- Node/Yarn（前端 Gradle 插件也配置了自动下载 Node 11.1.0 和 Yarn 1.12.3）

## 数据库

开发配置默认连接本机 `fxy` 数据库，用户名默认为 `root`，密码默认为空。可用环境变量覆盖：

```bash
export FINANCIAL_DB_URL='jdbc:mysql://localhost:3306/fxy?characterEncoding=UTF-8&useUnicode=true&useSSL=false&serverTimezone=GMT%2B8'
export FINANCIAL_DB_USERNAME='root'
export FINANCIAL_DB_PASSWORD='本机数据库密码'
mysql -u root -p -e 'CREATE DATABASE fxy CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'
mysql -u root -p fxy < financial.sql
```

**注意：** SQL dump 含样例用户及业务数据，只应导入隔离的本地开发库；不要导入生产环境或将其中的身份信息用于真实业务。

## 启动

在仓库根目录启动后端：

```bash
./gradlew :bs-server:bootRun
```

启动前端：

```bash
cd front-end
yarn install
yarn serve
```

前端默认运行在 `http://localhost:8081`，开发代理将 `/api` 请求转到后端 `http://localhost:8080`。

生产 profile 不包含数据库默认凭证，需显式配置：

```bash
export FINANCIAL_DB_URL='jdbc:mysql://db-host:3306/fxy_financial?characterEncoding=UTF-8&useUnicode=true&useSSL=false&serverTimezone=GMT%2B8'
export FINANCIAL_DB_USERNAME='应用专用数据库用户'
export FINANCIAL_DB_PASSWORD='从密钥管理系统获取的密码'
export ALIYUN_ACCESS_KEY_ID='短信服务 AccessKey ID'
export ALIYUN_ACCESS_KEY_SECRET='短信服务 AccessKey Secret'
```

然后使用 `SPRING_PROFILES_ACTIVE=prod ./gradlew :bs-server:bootRun` 启动。不要将生产凭证提交到 Git。

## 验证与打包

```bash
./gradlew :bs-server:test
./gradlew independentBuild
```

前端可单独构建：

```bash
cd front-end && yarn build
```
