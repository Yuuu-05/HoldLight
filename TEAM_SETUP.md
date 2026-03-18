## 队友启动说明

这份文档用于帮助队友从零开始在本地运行项目。

### 1. 需要从维护者那里拿到什么

每个队友都需要：

- GitHub 仓库地址：`https://github.com/Yuuu-05/CPT208-ClimbApp.git`
- 后端 `.env` 里的配置内容

如果需要运行完整视觉模型推理，还需要额外拿到：

- `climb-app-backend/vision_service/models/xiaoxiae/hold_detector/model_final.pth`
- `climb-app-backend/vision_service/models/xiaoxiae/route_triplet/triplet_network_final.pt`

下面这个配置文件已经在 Git 仓库里，不需要单独发送：

- `climb-app-backend/vision_service/models/xiaoxiae/experiment_config.yml`

### 2. 需要安装什么

如果只是正常运行前后端开发环境，需要安装：

- Git
- Node.js 20
- npm

如果要使用视觉识别功能，还需要安装：

- Python 3
- heuristic 模式需要的 Python 包：`numpy`、`opencv-python`
- 完整 xiaoxiae 模式额外需要：`torch`、`torchvision`、`detectron2`

如果只是先把项目跑起来并进行普通开发，建议先使用 `VISION_PROVIDER=heuristic`，这样不会一开始就卡在完整模型环境上。

### 3. 克隆仓库

```bash
git clone https://github.com/Yuuu-05/CPT208-ClimbApp.git
cd CPT208-ClimbApp
```

### 4. 前端 `.env` 怎么填

在 `climb-app-frontend` 目录下创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

可选配置：

```env
VITE_ENABLE_DEV_AUTH_BYPASS=true
```

### 5. 后端 `.env` 怎么填

在 `climb-app-backend` 目录下，根据 `climb-app-backend/.env.example` 创建 `.env` 文件。

最少需要填写这些内容：

```env
MONGO_URI=<向维护者获取 MongoDB 连接串>
JWT_SECRET=<向维护者获取密钥，或本地自行设置一个开发密钥>
JWT_EXPIRES_IN=7d
PORT=5000
BODY_LIMIT=12mb
VISION_PROVIDER=heuristic
VISION_PYTHON_COMMAND=python
```

说明：

- `MONGO_URI` 必须是可用的 MongoDB 连接字符串。
- `VISION_PYTHON_COMMAND` 必须按自己电脑的实际 Python 命令或路径填写，不要直接照抄别人的绝对路径。
- 如果后续要启用完整模型推理，可以把 `VISION_PROVIDER` 改成 `auto` 或 `xiaoxiae`。

### 6. 模型放到哪个目录

只有在需要运行完整 xiaoxiae 视觉模型时，才需要放模型文件。

请把模型文件放到下面这两个准确路径：

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

前端依赖安装：

```bash
cd climb-app-frontend
npm install
```

后端依赖安装：

```bash
cd climb-app-backend
npm install
```

如果使用 Python 的 heuristic 视觉模式，再安装：

```bash
pip install numpy opencv-python
```

如果要运行完整 xiaoxiae 模式，还需要再安装与本机环境匹配版本的：

- `torch`
- `torchvision`
- `detectron2`

### 8. 前后端分别怎么启动

先启动后端：

```bash
cd climb-app-backend
npm run dev
```

然后在另一个终端启动前端：

```bash
cd climb-app-frontend
npm run dev
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
