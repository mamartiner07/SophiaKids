/***********************************************************
 * ✅ Web App para Portal "Academia de Héroes del Service Desk"
 ***********************************************************/
function doGet(e) {
  const page = e.parameter.page || "index";
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle("SD GalaxIA | Exploradores Estelares")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Función para incluir otros archivos HTML (CSS, JS, Assets)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Retorna la URL del Web App para abrir el popup dinámicamente
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}



/***********************************************************
 * ✅ Obtener API Keys desde Script Properties
 ***********************************************************/
function getKey(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}


/***********************************************************
 * ✅ ROUTER API (doPost) para Hosting Externo
 ***********************************************************/
function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    let result;

    if (req.type === "tts") {
      result = processTTS(req.text);
    } else if (req.type === "ia") {
      result = processIA(req.text, req.history || []);
    } else {
      throw new Error("Tipo de solicitud inválido");
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/***********************************************************
 * ✅ GOOGLE CLOUD TEXT-TO-SPEECH (Callable)
 ***********************************************************/
function processTTS(text) {
  try {
    const apiKey = getKey("GOOGLE_TTS_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY no encontrada");

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const payload = {
      input: { text },
      voice: {
        languageCode: "es-US",
        name: "es-US-Standard-B"
      },
      audioConfig: {
        audioEncoding: "MP3"
      }
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("Error en Google TTS API: " + response.getContentText());
    }

    const data = JSON.parse(response.getContentText());
    return { success: true, audio: data.audioContent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


/***********************************************************
 * ✅ IA usando Gemini (Callable) - MODO MISSION MASTER
 ***********************************************************/
function processIA(prompt, history = []) {
  try {
    const apiKey = getKey("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY no encontrada");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `Eres Champi, el director del Service Desk Galaxia y un guía cósmico súper entusiasta de la 'Aventura Estelar'.

REGLAS DE ORO:
1. ¡Tu tono es épico, espacial y muy divertido para niños!
2. Usa términos como "Explorador", "Estelar", "Nebulosa", "Cometa".
3. Las misiones deben guiar al niño a través de una habitación física.
4. Responde ÚNICAMENTE con el objeto JSON. No escribas nada más fuera de las llaves.
5. No des mensajes tan largos, hazlos cortos y faciles de entender por los niños.

DINÁMICA DE JUEGO:
- Misión inicial: Saludo y pedir que diga "¡Despegue!".
- No hables con onomatopeyas de tipo AAAAHH o OOOh
- Dinámicas de sala: Dile que debe completar las estaciones en la habitación para encontrar la palabra secreta.
- En cada mensaje que envíes haz referencias a la película Super Mario Galaxy y a sus personajes.
- FINAL DEL JUEGO: La palabra clave para ganar es "ESTRELLA AZUL". Solo cuando el niño la diga, debes marcar "mission_complete": true.

ESTRUCTURA DE RESPUESTA (JSON):
{
  "speech": "Lo que dirás al niño de forma emocionante",
  "objective": "Instrucción corta (ej: 'Busca la palabra secreta')",
  "status_updates": { "hp": 0, "energy": 0, "xp": 10 },
  "visual_cue": "normal | alert | success | critical",
  "quick_actions": ["¡Listo!", "¿Qué sigue?"],
  "show_keyword_overlay": false,
  "mission_complete": false
}

CONTEXTO DE MISIONES:
- Misión 1 (Bienvenida): Da la bienvenida a SD GalaxIA y pide el grito de "¡Despegue!".
- Misión 2 (Exploración): Indica que debe ir a las estaciones de la habitación para conseguir la palabra clave. Da ánimos. IMPORTANTE: En esta misión debes activar "show_keyword_overlay": true para que aparezca el botón de confirmación tras tu audio.
- Misión 3 (Validación): Si dice algo incorrecto, anímalo a seguir buscando en la sala. No actives el overlay aquí a menos que repitas las instrucciones de búsqueda.
- Misión Final (Victoria): Si dice "ESTRELLA AZUL", celebra su triunfo, dale muchos puntos y marca mission_complete: true.`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido, Comandante. Iniciando Protocolo SOPHIA. Estoy lista para guiar al recluta. Esperando input..." }] }
    ];

    // Añadir historial si existe
    history.forEach(msg => {
      contents.push({
        role: msg.role,
        parts: [{ text: msg.text }]
      });
    });

    // Añadir el prompt actual
    contents.push({
      role: "user",
      parts: [{ text: prompt }]
    });

    const payload = { contents };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error("Error en Gemini API: " + response.getContentText());
    }

    const data = JSON.parse(response.getContentText());
    let resultText = data.candidates[0].content.parts[0].text;
    
    // Extracción robusta de JSON usando Regex
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No se encontró un JSON válido en la respuesta de la IA.");
    
    const cleanJson = jsonMatch[0];
    return { success: true, data: JSON.parse(cleanJson) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
