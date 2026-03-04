export interface Course {
  courseId: string;
  courseName: string;
  createdAt: string;
  chapterCount?: number;
  lastOpenAt?: string;
  emoji?: string;
}

export interface Chapter {
  chapterId: string;
  courseId: string;
  chapterName: string;
  orderIndex: number;
  createdAt?: string;
  pptCount?: number;
  lastOpenAt?: string;
}

export interface PPT {
  pptId: string;
  chapterId: string;
  courseId?: string;
  pptTitle: string;
  sourceFile?: string;
  fileType?: string;
  lastOpenAt?: string;
  lastPage?: number;
  totalPages?: number;
  createdAt?: string;
}

export interface NoteBlock {
  noteBlockId: string;
  pptId: string;
  pageRange: string;
  contentZh: string;
  contentEnKeyTerms: string[] | string; // 后端返回逗号分隔字符串
  createdAt: string;
}

export interface QA {
  qaId: string;
  pptId: string;
  noteBlockId: string | null;
  question: string;
  questionImage?: string | null;
  answer: string;
  status?: "queued" | "running" | "completed" | "failed";
  createdAt: string;
}

export const mockCourses: Course[] = [
  { courseId: "c1", courseName: "计算机网络", createdAt: "2025-09-01", chapterCount: 12, lastOpenAt: "2026-02-28", emoji: "🌐" },
  { courseId: "c2", courseName: "操作系统原理", createdAt: "2025-09-01", chapterCount: 10, lastOpenAt: "2026-02-25", emoji: "⚙️" },
  { courseId: "c3", courseName: "数据结构与算法", createdAt: "2025-09-01", chapterCount: 15, lastOpenAt: "2026-02-20", emoji: "🧮" },
  { courseId: "c4", courseName: "机器学习导论", createdAt: "2026-01-10", chapterCount: 8, lastOpenAt: "2026-02-27", emoji: "🤖" },
  { courseId: "c5", courseName: "数据库系统概论", createdAt: "2025-09-01", chapterCount: 11, lastOpenAt: "2026-02-15", emoji: "🗄️" },
  { courseId: "c6", courseName: "软件工程", createdAt: "2026-01-10", chapterCount: 9, lastOpenAt: "2026-02-10", emoji: "📐" },
];

export const mockChapters: Record<string, Chapter[]> = {
  c1: [
    { chapterId: "ch1-1", courseId: "c1", chapterName: "CH1 计算机网络概述", orderIndex: 1, pptCount: 2, lastOpenAt: "2026-02-28" },
    { chapterId: "ch1-2", courseId: "c1", chapterName: "CH2 物理层", orderIndex: 2, pptCount: 1, lastOpenAt: "2026-02-26" },
    { chapterId: "ch1-3", courseId: "c1", chapterName: "CH3 数据链路层", orderIndex: 3, pptCount: 3, lastOpenAt: "2026-02-24" },
    { chapterId: "ch1-4", courseId: "c1", chapterName: "CH4 网络层", orderIndex: 4, pptCount: 2, lastOpenAt: "2026-02-20" },
    { chapterId: "ch1-5", courseId: "c1", chapterName: "CH5 传输层", orderIndex: 5, pptCount: 2, lastOpenAt: "2026-02-18" },
    { chapterId: "ch1-6", courseId: "c1", chapterName: "CH6 应用层", orderIndex: 6, pptCount: 1, lastOpenAt: "2026-02-15" },
  ],
};

export const mockNotes: NoteBlock[] = [
  {
    noteBlockId: "n1",
    pptId: "ppt1",
    pageRange: "1-3",
    contentZh: "## 计算机网络的定义与分类\n\n计算机网络是指将地理位置不同的多台计算机及其外部设备，通过通信线路连接起来，在网络操作系统、网络管理软件及通信协议的管理和协调下，实现资源共享和信息传递的计算机系统。\n\n**关键分类：**\n- 按覆盖范围：LAN（局域网）、MAN（城域网）、WAN（广域网）\n- 按拓扑结构：星型、环型、总线型、网状型\n- 按传输介质：有线网络、无线网络",
    contentEnKeyTerms: ["Computer Network", "LAN", "MAN", "WAN", "Topology"],
    createdAt: "2026-02-28",
  },
  {
    noteBlockId: "n2",
    pptId: "ppt1",
    pageRange: "4-7",
    contentZh: "## 网络协议与分层模型\n\n网络协议（Protocol）是为计算机网络中数据交换而建立的规则、标准或约定的集合。\n\n**OSI 七层模型：**\n1. 物理层 - 比特流传输\n2. 数据链路层 - 帧传输\n3. 网络层 - 数据包路由\n4. 传输层 - 端到端通信\n5. 会话层 - 会话管理\n6. 表示层 - 数据格式转换\n7. 应用层 - 用户接口\n\n**TCP/IP 四层模型** 是实际广泛使用的模型，将 OSI 简化为：网络接口层、网际层、传输层、应用层。",
    contentEnKeyTerms: ["Protocol", "OSI Model", "TCP/IP", "Layer Architecture"],
    createdAt: "2026-02-28",
  },
  {
    noteBlockId: "n3",
    pptId: "ppt1",
    pageRange: "8-10",
    contentZh: "## 网络性能指标\n\n衡量计算机网络性能的主要指标：\n\n- **带宽（Bandwidth）**：网络通信线路所能传送数据的能力，单位 bps\n- **时延（Delay）**：数据从源到目的经历的时间\n  - 发送时延 = 数据长度 / 发送速率\n  - 传播时延 = 信道长度 / 传播速率\n  - 处理时延 + 排队时延\n- **吞吐量（Throughput）**：单位时间内通过网络的数据量\n- **时延带宽积**：传播时延 × 带宽",
    contentEnKeyTerms: ["Bandwidth", "Delay", "Throughput", "Latency"],
    createdAt: "2026-02-28",
  },
  {
    noteBlockId: "n4",
    pptId: "ppt1",
    pageRange: "11-13",
    contentZh: "## 香农定理与奈奎斯特定理\n\n信道容量的理论上限由以下公式决定：\n\n**奈奎斯特定理（无噪声信道）：**\n\n$$C = 2W \\log_2 L$$\n\n其中 $W$ 为信道带宽（Hz），$L$ 为信号的离散等级数，$C$ 为最大数据传输速率（bps）。\n\n**香农定理（有噪声信道）：**\n\n$$C = W \\log_2(1 + \\frac{S}{N})$$\n\n其中 $\\frac{S}{N}$ 为信噪比（SNR），通常用分贝表示：$SNR_{dB} = 10 \\log_{10} \\frac{S}{N}$\n\n**例题：** 若信道带宽 $W = 3000\\text{Hz}$，信噪比 $SNR = 30\\text{dB}$（即 $\\frac{S}{N} = 1000$），则：\n\n$$C = 3000 \\times \\log_2(1 + 1000) \\approx 3000 \\times 9.97 \\approx 29910 \\text{ bps}$$",
    contentEnKeyTerms: ["Shannon Theorem", "Nyquist Theorem", "Channel Capacity", "SNR"],
    createdAt: "2026-02-28",
  },
];

export const mockQAs: QA[] = [
  {
    qaId: "qa1",
    pptId: "ppt1",
    noteBlockId: "n1",
    question: "LAN 和 WAN 的主要区别是什么？",
    answer: "LAN（局域网）覆盖范围小，通常在一栋建筑或一个校园内，传输速率高（通常 100Mbps-10Gbps），误码率低。WAN（广域网）覆盖范围大，可跨越城市甚至国家，传输速率相对较低，通常需要租用运营商的线路。核心区别在于覆盖范围和所有权——LAN 通常是私有的，WAN 通常需要借助公共网络基础设施。",
    createdAt: "2026-02-28",
  },
  {
    qaId: "qa2",
    pptId: "ppt1",
    noteBlockId: "n2",
    question: "为什么实际中使用 TCP/IP 而不是 OSI 模型？",
    answer: "OSI 模型虽然理论上更完整，但存在几个问题：1）设计时过于理想化，会话层和表示层在实践中很少需要独立实现；2）TCP/IP 模型是先有协议实现后有模型总结，更贴合实际；3）TCP/IP 的实现更简洁高效。不过 OSI 模型作为教学和理解网络分层的参考框架仍然非常有价值。",
    createdAt: "2026-02-28",
  },
  {
    qaId: "qa3",
    pptId: "ppt1",
    noteBlockId: null,
    question: "这一章的考试重点是哪些？",
    answer: "根据这份 PPT 的内容，考试重点可能包括：\n1. 网络分类（LAN/MAN/WAN）及特点\n2. OSI 七层模型和 TCP/IP 四层模型的对比\n3. 网络性能指标的计算（尤其是时延和时延带宽积）\n4. 协议三要素（语法、语义、同步）\n建议重点掌握各层的功能和典型协议。",
    createdAt: "2026-02-28",
  },
];
