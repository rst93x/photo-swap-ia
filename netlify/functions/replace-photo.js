exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { image, mimeType, prompt } = JSON.parse(event.body);

    if (!image || !prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Image et description requis.' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Clé API manquante côté serveur.' }) };
    }

    const fullPrompt = `Edit this photo: ${prompt}. Keep everything else in the image exactly the same — same background, same lighting, same composition, same colors. Only change the specific element mentioned. The result must look photorealistic and seamlessly blended, as if it was part of the original photo.`;

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
                { text: fullPrompt },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: (data.error && data.error.message) || 'Erreur API Gemini.' }),
      };
    }

    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    let resultImage = null;
    let resultMime = 'image/png';
    let resultText = '';

    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (inline) {
        resultImage = inline.data;
        resultMime = inline.mimeType || inline.mime_type || resultMime;
      }
      if (part.text) {
        resultText += part.text;
      }
    }

    if (!resultImage) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Le modèle n'a pas renvoyé d'image.", details: resultText }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ image: resultImage, mimeType: resultMime }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
