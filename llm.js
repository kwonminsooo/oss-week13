// The only file that talks to the LLM provider.
// The provider, the model and the key come from .env:
//   process.env.LLM_BASE_URL, process.env.LLM_MODEL, process.env.LLM_API_KEY

const SYSTEM = `말투: 존댓말(해요체)로 답한다.
길이: 한 문단, 세 문장 이내로 답한다.
형식: 목록, 제목, 굵은 글씨 같은 마크다운을 쓰지 않는다.`;

const SYSTEM_JSON = `사용자가 보낸 상품 후기를 분석해서 JSON 객체 하나로만 답한다. JSON 밖에는 어떤 글자도 쓰지 않는다.
키는 정확히 다음 세 개만 쓴다: "sentiment", "score", "summary".
sentiment 가 "positive", "negative", "neutral" 중 하나인가 ([...].includes(sentiment))
score 가 1 이상 5 이하의 정수인가 (Number.isInteger(score) && score >= 1 && score <= 5)
summary 가 문자열인가 (typeof summary === "string")
`;

async function complete(messages, options = {}) {
  const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages,
      ...options,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ask("a question")  ->  the model's answer, as a string
export async function ask(question) {
  return complete([
    { role: "system", content: SYSTEM },
    { role: "user", content: question },
  ]);
}

// chat([{ role: "user", content: "..." }, { role: "assistant", content: "..." }, ...])
//   ->  the model's next answer, as a string
export async function chat(history) {
  return complete([{ role: "system", content: SYSTEM }, ...history]);
}

// analyze("a review")  ->  an object, not a sentence:
//   { sentiment: "positive" | "negative" | "neutral", score: 1..5, summary: "one short sentence" }
export async function analyze(text) {
  const content = await complete(
    [
      { role: "system", content: SYSTEM_JSON },
      { role: "user", content: text },
    ],
    { response_format: { type: "json_object" } },
  );

  const { sentiment, score, summary } = JSON.parse(content);

  if (
    !["positive", "negative", "neutral"].includes(sentiment) ||
    !(Number.isInteger(score) && score >= 1 && score <= 5) ||
    typeof summary !== "string"
  ) {
    throw new Error("LLM: the answer has the wrong shape");
  }

  return { sentiment, score, summary };
}
