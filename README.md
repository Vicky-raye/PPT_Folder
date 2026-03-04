# PPT Folder

本地运行：课程 → 章节 → 上传 PDF/PPT → AI 翻译总结与问答。

## 环境要求

- Node.js 18+
- Python 3.10+
- 火山方舟 API Key（豆包 doubao-seed-2.0-lite-260215）

## 1. 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

复制环境变量并填写 API Key：

```bash
copy .env.example .env   # Windows
# cp .env.example .env  # macOS/Linux
```

编辑 `.env`，必填：

- `ARK_API_KEY`：火山方舟 API Key
- `ARK_MODEL_ID`：如 `doubao-seed-2.0-lite-260215`

启动后端：

```bash
# 在 backend 目录下，已激活 venv
set PYTHONPATH=.   # Windows
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端地址：<http://localhost:8000>，API 文档：<http://localhost:8000/docs>。

## 2. 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 <http://localhost:5173>。

## 使用流程

1. **首页**：创建课程、搜索课程，点击课程进入章节列表。
2. **课程页**：添加章节，在章节下「上传 PDF/PPT」或点击已有文档「打开」。
3. **工作区**：
   - 左侧上：文档浏览（PDF 用浏览器内置查看，PPT 显示按页文本）。
   - 左侧下：点击「AI 翻译总结」生成知识点。
   - 右侧：输入问题发送，基于当前文档与知识点回答。

数据与上传文件保存在后端 `./data` 目录（SQLite + uploads）。
