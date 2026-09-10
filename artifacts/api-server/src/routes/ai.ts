import { Router, type IRouter } from "express";

const router: IRouter = Router();

type ChatLanguage = "ht" | "fr";

type AiChatBody = {
  question?: unknown;
  language?: unknown;
  imageData?: unknown;
};

function unavailableMessage(language: ChatLanguage) {
  return language === "fr"
    ? "L’IA n’est pas encore connectée. Le backend Faroh IA est prêt : ajoutez un fournisseur IA plus tard pour recevoir des réponses détaillées."
    : "IA a poko konekte. Backend Faroh IA a pare: n ap ka ajoute yon founisè IA pita pou resevwa repons ki detaye.";
}

function providerErrorMessage(language: ChatLanguage) {
  return language === "fr"
    ? "Le service IA est temporairement indisponible. Vérifiez la configuration du fournisseur puis réessayez."
    : "Sèvis IA a pa disponib pou kounye a. Verifye konfigirasyon founisè a epi eseye ankò.";
}

router.post("/ai/chat", async (req, res) => {
  const body = (req.body ?? {}) as AiChatBody;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const language: ChatLanguage = body.language === "fr" ? "fr" : "ht";

  if (!question || question.length > 4000) {
    res.status(400).json({
      code: "INVALID_REQUEST",
      message:
        language === "fr"
          ? "La question doit contenir entre 1 et 4 000 caractères."
          : "Kesyon an dwe genyen ant 1 ak 4 000 karaktè.",
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      code: "AI_NOT_CONFIGURED",
      message: unavailableMessage(language),
    });
    return;
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const systemPrompt =
    language === "fr"
      ? "Tu es Faroh IA, un tuteur patient pour les élèves. Réponds en français. Pour les exercices, explique chaque étape clairement et vérifie les unités. Ne donne pas seulement le résultat."
      : "Ou se Faroh IA, yon pwofesè pasyan pou elèv. Reponn an kreyòl ayisyen. Pou egzèsis, eksplike chak etap klèman epi verifye inite yo. Pa bay repons lan sèlman.";

  try {
    const providerResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 1200,
      }),
    });

    if (!providerResponse.ok) {
      req.log.warn({ status: providerResponse.status }, "AI provider request failed");
      res.status(502).json({
        code: "AI_PROVIDER_UNAVAILABLE",
        message: providerErrorMessage(language),
      });
      return;
    }

    const payload = (await providerResponse.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const message = payload.choices?.[0]?.message?.content;

    if (typeof message !== "string" || !message.trim()) {
      req.log.warn("AI provider returned an empty response");
      res.status(502).json({
        code: "AI_EMPTY_RESPONSE",
        message: providerErrorMessage(language),
      });
      return;
    }

    res.json({
      message: message.trim(),
      provider: "openai",
      configured: true,
    });
  } catch (error) {
    req.log.error({ err: error }, "AI provider request errored");
    res.status(502).json({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: providerErrorMessage(language),
    });
  }
});

export default router;