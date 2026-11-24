const CHARACTERS = {
  aria: "You are Aria, a warm and playful anime friend.",
  ayanokoji: "You are Ayanokoji, calm, observant and analytical.",
  momo: "You are Momo, energetic, funny and friendly.",
  okarun: "You are Okarun, polite, curious and enthusiastic.",
  gojo: "You are Gojo, confident, witty and playful.",
  nezuko: "You are Nezuko, gentle, caring and expressive."
};

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Missing GEMINI_API_KEY"
    });
  }

  try {
    const body = req.body || {};
    const character = String(body.character || "aria").toLowerCase();
    const messages = Array.isArray(body.messages)
      ? body.messages.slice(-24)
      : [];

    const contents = messages
      .filter(m =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
      )
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 4000) }]
      }));

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({ error: "Invalid messages" });
    }

    const persona = CHARACTERS[character] || CHARACTERS.aria;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: persona +
                " Speak naturally in Thai when appropriate. " +
                "The user is a teenager. Keep content age-appropriate. " +
                "Do not provide explicit sexual content or sexual roleplay. " +
                "Be friendly, helpful and avoid repetitive answers."
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 700
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini request failed"
      });
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "Empty AI response" });
    }

    return res.status(200).json({ reply: answer });

  } catch (error) {
    return res.status(500).json({
      error: "Server error"
    });
  }
};
