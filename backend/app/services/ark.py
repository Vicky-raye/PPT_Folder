from typing import Optional, List
import base64
import mimetypes
from openai import OpenAI
from app.config import ARK_API_KEY, ARK_MODEL_ID, ARK_BASE_URL

_ark_client: Optional[OpenAI] = None

def get_client() -> OpenAI:
    global _ark_client
    if _ark_client is None:
        if not ARK_API_KEY:
            raise RuntimeError("ARK_API_KEY is not set")
        _ark_client = OpenAI(
            api_key=ARK_API_KEY,
            base_url=ARK_BASE_URL,
        )
    return _ark_client

def chat(messages: List[dict], stream: bool = False):
    return get_client().chat.completions.create(
        model=ARK_MODEL_ID,
        messages=messages,
        stream=stream,
    )

def extract_notes_system_prompt() -> str:
    return """请逐页翻译其中关于知识点部分的ppt，输出一份知识点笔记，确保涵盖每一页ppt的每一个知识点，教师介绍、课程安排等无关内容直接跳过。

1. 不要遗漏任何一页ppt，不要遗漏任何一个知识点。
2. 注意保留关键词句英文表达。
3. 不要遗漏任何一道题目的题干，练习题目需要同时保留中英文。
4. 按照课程知识点、题目顺序梳理笔记，请勿将所有题目聚合到最后一部分。
5. 注意输出格式，确保所有内容需要可以直接复制到飞书中而不会出现乱码。

请直接输出一整份知识点笔记正文，不要输出 JSON 或其它格式说明。"""


def extract_notes(page_texts: List[dict]) -> str:
    """调用豆包生成知识点笔记，返回一整段文本（一大段笔记）。"""
    parts = []
    for p in page_texts:
        parts.append(f"【第{p.get('page_index', p.get('page_range', '?'))}页】\n{p.get('text', '')}")
    user_content = "请根据以下按页文档内容，按系统提示要求输出一份完整的知识点笔记。\n\n" + "\n\n".join(parts)
    resp = chat([
        {"role": "system", "content": extract_notes_system_prompt()},
        {"role": "user", "content": user_content}
    ])
    return (resp.choices[0].message.content or "").strip()

def qa_answer(
    ppt_title: str,
    note_blocks_text: str,
    qa_history: List[dict],
    question: str,
    note_block_context: Optional[str],
    image_path: Optional[str] = None,
) -> str:
    """基于 PPT 标题、已有知识点、历史问答和当前问题，生成回答。"""
    context_parts = [f"文档标题：{ppt_title}", f"知识点摘要：\n{note_blocks_text}"]
    if note_block_context:
        context_parts.append(f"当前选中的知识点：\n{note_block_context}")
    if qa_history:
        context_parts.append("历史问答：")
        for h in qa_history[-5:]:
            context_parts.append(f"Q: {h.get('question','')}\nA: {h.get('answer','')}")
    context_parts.append(f"用户新问题：{question}")
    user_content = "\n\n".join(context_parts)
    if image_path:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        mime = mimetypes.guess_type(image_path)[0] or "image/png"
        content = [
            {"type": "text", "text": user_content},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ]
        resp = chat([{"role": "user", "content": content}])
    else:
        resp = chat([{"role": "user", "content": user_content}])
    return resp.choices[0].message.content or ""
