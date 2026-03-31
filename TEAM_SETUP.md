## 队友启动说明

这份文档用于帮助队友从零开始在本地运行项目。

### 1. 需要从维护者那里拿到什么

每个队友都需要：

- GitHub 仓库地址：`https://github.com/Yuuu-05/CPT208-ClimbApp.git`
- 对这个私有仓库的访问权限

当前团队开发流程里，仓库已经直接跟踪了前后端 `.env` 文件，组员拉取最新代码后不需要再单独索要 `.env`。

如果未来仓库改成公开仓库，必须立刻移除这些 `.env` 文件并轮换相关密钥。

### 2. 需要安装什么

如果只是正常运行前后端开发环境，需要安装：

- Git
- Git LFS
- Node.js 20
- npm

如果要使用视觉识别功能，还需要安装：

- Python 3
- heuristic 模式需要的 Python 包：`numpy`、`opencv-python`
- 完整 xiaoxiae 模式额外需要：`torch`、`torchvision`、`detectron2`

如果只是先把项目跑起来并进行普通开发，建议先使用 `VISION_PROVIDER=heuristic`，这样不会一开始就卡在完整模型环境上。

### 3. 克隆仓库

```bash
git lfs install
git clone https://github.com/Yuuu-05/CPT208-ClimbApp.git
cd CPT208-ClimbApp
git lfs pull
```

### 4. `.env` 现在怎么处理

当前私有团队仓库已经直接包含：

- `climb-app-frontend/.env`
- `climb-app-backend/.env`

所以在现在这套团队协作方式下，组员拉取最新代码后一般不需要再手动创建 `.env`。

如果以后不想继续把真实配置提交到 Git，请改回使用：

- `climb-app-frontend/.env.example`
- `climb-app-backend/.env.example`

然后把真实配置通过私下渠道发给组员。

### 6. 模型放到哪个目录

完整 xiaoxiae 视觉模型文件现在通过 Git LFS 跟随仓库分发。

组员完成 `git lfs install`、`git clone`、`git lfs pull` 后，模型文件应该出现在下面这两个准确路径：

- `climb-app-backend/vision_service/models/xiaoxiae/hold_detector/model_final.pth`
- `climb-app-backend/vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt`

目录结构应如下：

```text
climb-app-backend/
  vision_service/
    models/
      xiaoxiae/
        experiment_config.yml
        hold_detector/
          model_final.pth
        route_triplet/
          triplet_network_final.pt
```

### 7. 安装依赖

前端和后端 Node.js 依赖可以直接在仓库根目录安装：

```bash
npm run install:all
```

如果使用 Python 的 heuristic 视觉模式，安装：

```bash
python -m pip install -r climb-app-backend/requirements-heuristic.txt
```

如果要运行完整 xiaoxiae 模式，安装：

```bash
python -m pip install -r climb-app-backend/requirements-xiaoxiae.txt
```

### 8. 前后端分别怎么启动

先启动后端：

```bash
npm run dev:backend
```

然后在另一个终端启动前端：

```bash
npm run dev:frontend
```

默认本地地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:5000`

### 9. 启动后快速检查

后端启动后，可以检查：

- `http://localhost:5000/api/health`
- 可选：`http://localhost:5000/api/vision/health`

如果前端连不上后端，请检查：

- 前端 `.env` 是否正确
- 后端 `.env` 是否正确
- 后端是否真的运行在 `5000` 端口

如果视觉推理失败，请检查：

- `VISION_PROVIDER` 配置是否正确
- Python 是否已安装并可用
- 模型文件是否放在上面写的准确目录里
- 如果启用了完整模型模式，`torch`、`torchvision`、`detectron2` 是否已经安装
