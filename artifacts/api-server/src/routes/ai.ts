import { Router, type IRouter } from "express";

const router: IRouter = Router();

type ChatLanguage = "ht" | "fr";

type AiChatBody = {
  question?: unknown;
  language?: unknown;
};

function unavailableMessage(language: ChatLanguage) {
  return language === "fr"
    ? "L’IA n’est pas disponible pour le moment. Vérifiez la configuration de Gemini."
    : "IA a pa disponib pou kounye a. Verifye konfigirasyon Gemini a.";
}

function providerErrorMessage(language: ChatLanguage) {
  return language === "fr"
    ? "Le service IA est temporairement indisponible. Réessayez dans quelques instants."
    : "Sèvis IA a pa disponib pou kounye a. Eseye ankò pita.";
}

router.post("/ai/chat", async (req, res) => {
  const body = (req.body ?? {}) as AiChatBody;

  const question =
    typeof body.question === "string" ? body.question.trim() : "";

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

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    res.status(503).json({
      code: "AI_NOT_CONFIGURED",
      message: unavailableMessage(language),
    });
    return;
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const systemPrompt =
    language === "fr"
      ? "Tu es Faroh IA, un tuteur patient pour les élèves. Réponds en français. Pour les exercices, explique chaque étape clairement et ne donne pas seulement le résultat."
      : "Ou se Faroh IA, yon pwofesè pasyan pou elèv. Reponn an kreyòl ayisyen. Pou egzèsis, eksplike chak etap klèman. Pa bay repons lan sèlman.";

  try {
    const providerResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: question }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1200,
          },
        }),
      },
    );

    if (!providerResponse.ok) {
      const errorPayload = (await providerResponse
        .json()
        .catch(() => null)) as {
        error?: { message?: unknown };
      } | null;
      const providerMessage =
        typeof errorPayload?.error?.message === "string"
          ? errorPayload.error.message
          : undefined;
      req.log.warn(
        {
          status: providerResponse.status,
          model,
          providerMessage,
        },
        "Gemini request failed",
      );

      if (providerResponse.status === 401 || providerResponse.status === 403) {
        res.status(503).json({
          code: "GEMINI_AUTH_FAILED",
          message:
            language === "fr"
              ? "La clé Gemini n’est pas acceptée. Vérifiez que GEMINI_API_KEY est une clé Gemini API valide et que l’API Generative Language est activée."
              : "Kle Gemini a pa aksepte. Verifye GEMINI_API_KEY la se yon kle Gemini API ki valab epi API Generative Language la aktive.",
        });
        return;
      }

      res.status(502).json({
        code: "AI_PROVIDER_UNAVAILABLE",
        message: providerErrorMessage(language),
      });
      return;
    }

    const payload = (await providerResponse.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: unknown;
          }>;
        };
      }>;
    };

    const message =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
        .trim();

    if (!message) {
      res.status(502).json({
        code: "AI_EMPTY_RESPONSE",
        message: providerErrorMessage(language),
      });
      return;
    }

    res.json({
      message,
      provider: "gemini",
      configured: true,
    });
  } catch (error) {
    req.log.error({ err: error, model }, "Gemini provider request errored");

    res.status(502).json({
      code: "AI_PROVIDER_UNAVAILABLE",
      message: providerErrorMessage(language),
    });
  }
});

export default router;