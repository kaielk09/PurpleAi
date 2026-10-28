import json
import os
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from huggingface_hub import hf_hub_download

MODEL_ID = os.getenv("PURPLEAI_MODEL_ID", "Kamiljdds/purpleaiV1.0")
CHECKPOINT_FILE = os.getenv("PURPLEAI_CHECKPOINT_FILE", "purple_ai_latest.pt")
VOCAB_FILE = os.getenv("PURPLEAI_VOCAB_FILE", "vocab.json")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MAX_NEW_TOKENS = int(os.getenv("PURPLEAI_MAX_NEW_TOKENS", "256"))

from torch import nn
from torch.nn import functional as F

class AttentionHead(nn.Module):
    def __init__(self, head_size: int, embed: int, block_size: int, dropout: float = 0.1):
        super().__init__()
        self.key = nn.Linear(embed, head_size, bias=False)
        self.query = nn.Linear(embed, head_size, bias=False)
        self.value = nn.Linear(embed, head_size, bias=False)
        self.register_buffer("mask", torch.tril(torch.ones(block_size, block_size)))
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        _, t, _ = x.shape
        k, q = self.key(x), self.query(x)
        weights = q @ k.transpose(-2, -1) * (k.shape[-1] ** -0.5)
        weights = weights.masked_fill(self.mask[:t, :t] == 0, float("-inf"))
        weights = self.dropout(F.softmax(weights, dim=-1))
        return weights @ self.value(x)

class MultiHeadAttention(nn.Module):
    def __init__(self, embed: int, heads: int, block_size: int, dropout: float = 0.1):
        super().__init__()
        size = embed // heads
        self.heads = nn.ModuleList([AttentionHead(size, embed, block_size, dropout) for _ in range(heads)])
        self.proj = nn.Linear(embed, embed)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        return self.dropout(self.proj(torch.cat([h(x) for h in self.heads], dim=-1)))

class Block(nn.Module):
    def __init__(self, embed: int, heads: int, block_size: int, dropout: float = 0.1):
        super().__init__()
        self.attn = MultiHeadAttention(embed, heads, block_size, dropout)
        self.ff = nn.Sequential(nn.Linear(embed, 4 * embed), nn.ReLU(), nn.Linear(4 * embed, embed), nn.Dropout(dropout))
        self.ln1 = nn.LayerNorm(embed)
        self.ln2 = nn.LayerNorm(embed)

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        return x + self.ff(self.ln2(x))

class PurpleGPT(nn.Module):
    def __init__(self, vocab_size: int, block_size: int, embed: int, heads: int, layers: int):
        super().__init__()
        self.block_size = block_size
        self.token_embedding = nn.Embedding(vocab_size, embed)
        self.position_embedding = nn.Embedding(block_size, embed)
        self.blocks = nn.Sequential(*[Block(embed, heads, block_size) for _ in range(layers)])
        self.norm = nn.LayerNorm(embed)
        self.head = nn.Linear(embed, vocab_size)

    def forward(self, idx):
        _, t = idx.shape
        x = self.token_embedding(idx) + self.position_embedding(torch.arange(t, device=idx.device))
        return self.head(self.norm(self.blocks(x)))

app = FastAPI(title="PurpleAI Inference API", version="1.0.0")
model = None
vocab = None
stoi = None
itos = None
block_size = 128

@app.on_event("startup")
def load_model():
    global model, vocab, stoi, itos, block_size
    token = os.getenv("HF_TOKEN")
    try:
        ckpt_path = hf_hub_download(repo_id=MODEL_ID, filename=CHECKPOINT_FILE, token=token)
        vocab_path = hf_hub_download(repo_id=MODEL_ID, filename=VOCAB_FILE, token=token)
    except Exception as e:
        raise RuntimeError(f"Could not download checkpoint/vocab from {MODEL_ID}: {e}") from e

    # This checkpoint is produced by our own training script; only load files from the trusted model repo.
    checkpoint = torch.load(ckpt_path, map_location=DEVICE, weights_only=False)
    config = checkpoint.get("config", {})
    block_size = int(config.get("block_size", 128))
    embed = int(config.get("embed", 128))
    heads = int(config.get("heads", 4))
    layers = int(config.get("layers", 4))
    vocab = json.loads(Path(vocab_path).read_text(encoding="utf-8"))
    if not isinstance(vocab, list) or not vocab:
        raise RuntimeError("vocab.json must contain a non-empty JSON list of characters")
    stoi = {ch: i for i, ch in enumerate(vocab)}
    itos = {i: ch for ch, i in stoi.items()}
    model = PurpleGPT(len(vocab), block_size, embed, heads, layers).to(DEVICE)
    model.load_state_dict(checkpoint["model"])
    model.eval()

class Message(BaseModel):
    role: str = "user"
    content: str

class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1)
    max_tokens: int = Field(default=160, ge=1, le=1024)
    temperature: float = Field(default=0.8, ge=0.0, le=2.0)

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "loaded": model is not None, "device": DEVICE}

@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": MODEL_ID, "object": "model", "owned_by": "Kamiljdds"}]}

@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    if model is None or vocab is None:
        raise HTTPException(status_code=503, detail="PurpleAI model is not loaded")
    # This is character-level continuation; it is not instruction-tuned ChatGPT behavior.
    prompt_parts = []
    for m in req.messages[-8:]:
        label = "Użytkownik" if m.role.lower() in ("user", "human") else "PurpleAI"
        prompt_parts.append(f"{label}: {m.content.strip()}\n")
    prompt = "".join(prompt_parts) + "PurpleAI:"
    encoded = [stoi[ch] for ch in prompt if ch in stoi]
    if not encoded:
        encoded = [0]
    context = torch.tensor([encoded[-block_size:]], dtype=torch.long, device=DEVICE)
    generated = []
    temperature = max(req.temperature, 0.05)
    limit = min(req.max_tokens, MAX_NEW_TOKENS)
    with torch.no_grad():
        for _ in range(limit):
            logits = model(context[:, -block_size:])[:, -1, :] / temperature
            probs = F.softmax(logits, dim=-1)
            next_id = int(torch.multinomial(probs, num_samples=1).item())
            generated.append(itos[next_id])
            context = torch.cat([context, torch.tensor([[next_id]], device=DEVICE)], dim=1)
    answer = "".join(generated).split("\nUżytkownik:", 1)[0].strip()
    if not answer:
        answer = "(model nie wygenerował tekstu)"
    import time
    return {"id": f"chatcmpl-{int(time.time())}", "object": "chat.completion", "created": int(time.time()), "model": MODEL_ID, "choices": [{"index": 0, "message": {"role": "assistant", "content": answer}, "finish_reason": "length"}]}
