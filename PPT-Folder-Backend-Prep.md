# PPT Folder — 后端准备文档（Backend Preparation Doc）

> 依据《PPT-Folder-Product-Doc.md》整理，供后端设计与实现参考。

---

## 1. 文档用途与范围

- **用途**：与后端/服务端团队对齐接口、数据与实现要点。
- **范围**：API 设计、数据模型、存储与 AI 集成、异常与扩展点。
- **前置**：产品目标、信息架构、页面状态与数据视角见产品文档 §2–§8。

---

## 2. 数据模型与持久化（对应产品文档 §8）

### 2.1 实体与字段（建议表/集合）

| 实体 | 建议主键 | 核心字段 | 备注 |
|------|----------|----------|------|
| **Course** | `courseId` | `courseName`, `createdAt` | 可选：`updatedAt`, `userId`（多租户） |
| **Chapter** | `chapterId` | `courseId`, `chapterName`, `orderIndex` | 可选：`createdAt` |
| **PPT** | `pptId` | `chapterId`, `pptTitle`, `sourceFile`, `lastOpenAt`, `lastPage` | `sourceFile` 为存储路径或 URL |
| **NoteBlock** | `noteBlockId` | `pptId`, `pageRange`, `contentZh`, `contentEnKeyTerms`, `createdAt` | 翻译即提炼产物 |
| **QA** | `qaId` | `pptId`, `noteBlockId`(可空), `question`, `answer`, `createdAt` | `noteBlockId` 为空表示整份 PPT 级问答 |

### 2.2 关系与约束

- **Course → Chapter**：一对多；删除课程时需约定章节/PPT/笔记/问答的级联策略（软删或硬删）。
- **Chapter → PPT**：一对多；`PPT.sourceFile` 需与对象存储/文件服务配合。
- **PPT → NoteBlock**：一对多；按 `pageRange` 或 `createdAt` 排序。
- **PPT → QA**：一对多；可选索引：`(pptId, createdAt)`、`(pptId, noteBlockId)` 以支持“按 PPT / 按知识点”查历史。

### 2.3 需要后端落地的“状态”字段

- **PPT**：`lastOpenAt`, `lastPage` — 用于“历史恢复态”（恢复上次页码与上下文）。
- 若需“处理中”防重入或幂等，可为 **PPT** 或 **NoteBlock** 增加：`processingStatus`（e.g. `idle | generating | done | error`）、`processingStartedAt`。

---

## 3. 文件与存储

### 3.1 PPT 源文件

- **上传**：支持 PPT/PPTX 上传；接口需返回可持久使用的 `sourceFile`（如对象存储 key 或 CDN URL）。
- **解析**：若后端参与“按页/按章节”解析（供前端展示或供 AI 按页提炼），需明确：
  - 解析结果存储形式（如每页文本/缩略图 URL 存 DB 或缓存）；
  - 与 AI 服务之间的数据格式（按页文本、页码边界等）。
- **容量与限流**：建议单文件大小上限、单用户/单课程存储配额与清理策略。

### 3.2 大对象与流式内容

- **NoteBlock**：`contentZh` 可能较长；若流式写入，需支持“追加/覆盖”语义与事务或版本控制，避免并发冲突。
- **QA**：`answer` 可能较长；若 AI 流式输出，需支持流式写入或先缓后落库。

---

## 4. API 范围建议

### 4.1 课程与章节（Homepage / Course 页）

| 能力 | 建议方法 | 说明 |
|------|----------|------|
| 课程列表 | `GET /courses` | 支持关键词搜索（对应“搜索态”）；分页 |
| 课程详情 | `GET /courses/:courseId` | 含章节列表或通过下一层接口获取 |
| 创建课程 | `POST /courses` | body: `courseName` 等 |
| 章节列表 | `GET /courses/:courseId/chapters` | 支持排序 `orderIndex`；可选筛选（时间/标签，若产品扩展） |
| 创建章节 | `POST /courses/:courseId/chapters` | body: `chapterName`, `orderIndex` |

### 4.2 PPT 与工作区（PPT Workspace）

| 能力 | 建议方法 | 说明 |
|------|----------|------|
| 上传 PPT | `POST /chapters/:chapterId/ppts` | multipart 或先拿上传 URL 再回调确认；返回 `pptId`, `sourceFile` |
| PPT 元信息 | `GET /ppts/:pptId` | 含 `lastOpenAt`, `lastPage`；用于历史恢复 |
| 更新上次打开 | `PATCH /ppts/:pptId` | body: `lastOpenAt`, `lastPage`（前端离开或翻页时上报） |
| 知识点列表 | `GET /ppts/:pptId/note-blocks` | 按 `pageRange` 或 `createdAt` 排序 |
| 流式生成知识点 | `POST /ppts/:pptId/note-blocks` 或 独立 `POST /ppts/:pptId/actions/extract-notes` | 见 §5；需与 AI 管道对接 |
| 问答历史 | `GET /ppts/:pptId/qa` | 支持按 `noteBlockId` 过滤；分页 |
| 提交追问 | `POST /ppts/:pptId/qa` | body: `noteBlockId?`, `question`；可能触发 AI 生成 `answer` 并落库 |

### 4.3 搜索与过滤

- 课程搜索：`GET /courses?q=...`（对应产品文档“快速搜索课程名”）。
- 章节筛选：若产品扩展“按时间/标签筛选”，需预留 `GET /courses/:courseId/chapters?...` 的 query 参数。

---

## 5. AI 集成要点

### 5.1 知识点提炼（翻译即提炼）

- **触发**：由“按页/按章节提炼”的前端操作触发；后端需提供接口（如 `POST /ppts/:pptId/actions/extract-notes`），入参可含 `pageRange` 或页码集合。
- **输入**：当前 PPT 对应页的文本（或图片，若用多模态）；需与解析层约定格式。
- **输出**：对应 §8.4 的 NoteBlock 字段：`pageRange`, `contentZh`, `contentEnKeyTerms`；流式时需支持分段写入并最终落库为一条/多条 NoteBlock。
- **幂等与重试**：建议 `processingStatus` + 可选 `idempotencyKey`；异常态“局部重试”不清空已有内容，需后端支持按页或按块覆盖/追加。

### 5.2 追问回答（QA）

- **触发**：用户提交问题；后端 `POST /ppts/:pptId/qa` 接收 `question`、可选 `noteBlockId`，调用 AI 生成 `answer`。
- **上下文**：需把当前 PPT 元信息、可选单个 NoteBlock 内容、以及必要的历史 QA 组装为 context 传给 AI。
- **流式**：若需“回复分段出现”，需支持流式响应（如 SSE/WebSocket）并在流结束后将完整 `answer` 写入 QA 表。

### 5.3 错误与降级

- 明确 AI 调用失败、超时、限流时的 HTTP 状态与错误码；产品要求“局部重试，不清空已有内容”，后端需避免整份覆盖写入。

---

## 6. 非功能与扩展

### 6.1 多租户与鉴权（若首版需要）

- 所有资源（Course / Chapter / PPT / NoteBlock / QA）建议与 `userId`（或 tenantId）绑定；列表与详情接口需按身份过滤。
- 产品文档将“复杂协同、权限系统”列为非目标，首版可仅单用户或简单拥有者校验。

### 6.2 性能与索引

- 列表类：`courses`（含搜索）、`chapters`、`note-blocks`、`qa` 建议有合适索引（如 `courseId`, `pptId`, `createdAt`）。
- “历史恢复”依赖 `GET /ppts/:pptId` 与 `lastPage`，读多写少，可做缓存。

### 6.3 可扩展点（产品未要求，后端可预留）

- Course/Chapter 的软删除与恢复。
- 标签、时间筛选（章节/PPT 维度）。
- 使用量统计（存储、AI 调用次数）便于后续计费或限流。

---

## 7. 与产品文档的对应关系

| 产品文档章节 | 后端关注点 |
|--------------|------------|
| §5 信息架构 | 课程/章节/PPT 三层资源的 CRUD 与树形查询 |
| §6 布局与绑定规则 | 无直接后端依赖；仅影响前端如何调接口 |
| §7 页面与交互状态 | 空态（列表无数据）、处理中（生成中状态）、异常态（错误码与重试） |
| §8 内容结构定义 | 本节 §2 数据模型与 §4 API 范围 |

---

## 8. 建议交付物清单（后端）

- [ ] 数据模型/表结构定稿（含字段类型、索引、级联策略）
- [ ] 对象存储/文件服务方案与 `sourceFile` 规范
- [ ] REST/API 设计文档或 OpenAPI 描述（含错误码）
- [ ] AI 管道接口约定（提炼、追问的入参/出参、流式协议）
- [ ] 流式写入 NoteBlock/QA 的幂等与并发策略
- [ ] 多租户/鉴权方案（若首版包含）

---

*文档版本：v1.0，与产品文档 v1.0（规划稿）对应。*
