# 队友启动说明

这份文档用于帮助队友从零开始在本地运行项目。

## 1. 先准备什么

- Git
- Git LFS
- Node.js 20+
- Python 3.10+

仓库地址：

```bash
https://github.com/Yuuu-05/CPT208-ClimbApp.git
```

## 2. 克隆仓库并拉取模型文件

```bash
git lfs install
git clone https://github.com/Yuuu-05/CPT208-ClimbApp.git
cd CPT208-ClimbApp
git lfs pull
```

## 3. 环境变量

当前私有团队仓库仍然跟踪开发用 `.env` 文件：

- `climb-app-frontend/.env`
- `climb-app-backend/.env`

如果后续不再跟踪真实配置，请改用：

- `climb-app-frontend/.env.example`
- `climb-app-backend/.env.example`

并通过私下渠道分发真实密钥。

## 4. 安装依赖

先安装前后端的 Node.js 依赖：

```bash
npm run install:all
```

再安装后端 Python 依赖：

```bash
cd climb-app-backend
.venv/bin/python -m pip install -r requirements-xiaoxiae.txt
```

注意：

- `VISION_PROVIDER=heuristic` 已经移除
- 现在只支持 `VISION_PROVIDER=xiaoxiae`
- 本地后端建议使用 `VISION_PYTHON_COMMAND=.venv/bin/python`

## 5. 检查模型文件

完整视觉功能依赖以下两个模型文件：

- `climb-app-backend/vision_service/models/xiaoxiae/hold_detector/model_final.pth`
- `climb-app-backend/vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt`

如果 `git lfs pull` 成功，这两个文件应该已经在仓库中。

## 6. 启动项目

先启动后端：

```bash
npm run dev:backend
```

再启动前端：

```bash
npm run dev:frontend
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:5000`

## 7. 快速检查

后端启动后先看：

- `http://localhost:5000/api/health`
- `http://localhost:5000/api/vision/health`

如果视觉功能报错，优先检查：

- `VISION_PROVIDER` 是否为 `xiaoxiae`
- `VISION_PYTHON_COMMAND` 是否指向 `climb-app-backend/.venv/bin/python`
- 两个模型文件是否存在
- `torch`、`torchvision`、`detectron2` 是否安装成功

## 8. 部署文档

云端部署看：

- `DEPLOYMENT.md`
- `deploy/northflank/README.md`
