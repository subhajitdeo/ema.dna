// ==================== script.js ====================
// Zara.ai - Ultimate Upgrade: Streaming, Smart Memory, Stable Voice, JSON Guarantee

// ---------- DOM Elements ----------
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const thinkingIndicator = document.getElementById('thinkingIndicator');
const thinkingTextSpan = document.getElementById('thinkingText');
const voiceStatusSpan = document.getElementById('voiceStatus');
const aiOrb = document.getElementById('aiOrb');
const soundWave = document.getElementById('soundWave');
const continuousModeToggle = document.getElementById('continuousModeToggle');

// ---------- App State ----------
let openRouterApiKey = localStorage.getItem('zara_openrouter_key') || '';
let isListening = false;
let recognition = null;
let synth = window.speechSynthesis;
let continuousMode = true;
let isSpeaking = false;
let pendingRestart = false;
let abortController = null;          // for streaming cancellation

// ---------- Voice Preparation ----------
let availableVoices = [];
function loadVoices() {
    availableVoices = speechSynthesis.getVoices();
}
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

// ---------- Site Map (for direct opening) ----------
const siteMap = {
    youtube: 'https://youtube.com',
    gmail: 'https://mail.google.com',
    whatsapp: 'https://web.whatsapp.com',
    instagram: 'https://instagram.com',
    github: 'https://github.com',
    twitter: 'https://x.com',
    reddit: 'https://reddit.com',
    spotify: 'https://spotify.com',
    netflix: 'https://netflix.com',
    facebook: 'https://facebook.com',
    linkedin: 'https://linkedin.com',
    amazon: 'https://amazon.com',
    twitch: 'https://twitch.tv',
    discord: 'https://discord.com',
    google: 'https://google.com',
    bing: 'https://bing.com',
    cnn: 'https://cnn.com',
    bbc: 'https://bbc.com',
    reuters: 'https://reuters.com',
    wikipedia: 'https://wikipedia.org'
};

// ---------- UI Helpers ----------
function renderMessage(text, isUser, toolData = null, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    if (isError) messageDiv.style.opacity = '0.7';
    const avatarIcon = isUser ? '<i class="fas fa-user-astronaut"></i>' : '<i class="fas fa-microchip"></i>';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
    let sourceHtml = '';
    if (toolData?.sourceLinks?.length) {
        sourceHtml = `<div class="source-links">${toolData.sourceLinks.map(link => `<a href="${link.url}" target="_blank" class="source-link"><i class="fas fa-external-link-alt"></i> ${link.label}</a>`).join('')}</div>`;
    }
    messageDiv.innerHTML = `
        <div class="avatar">${avatarIcon}</div>
        <div class="content"><p>${text}</p>${sourceHtml}</div>
        <div class="timestamp">${timestamp}</div>
    `;
    chatMessages.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addSystemMessage(text, isError = false) {
    renderMessage(text, false, null, isError);
}

function addMessage(text, isUser, toolData = null) {
    renderMessage(text, isUser, toolData);
    let history = JSON.parse(localStorage.getItem('zara_chat_history') || '[]');
    history.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() });
    if (history.length > 100) history = history.slice(-100); // keep more for summaries
    localStorage.setItem('zara_chat_history', JSON.stringify(history));
}

// ---------- Text-to-Speech ----------
function speakText(text) {
    if (!synth) return;
    synth.cancel();
    isSpeaking = true;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    const voices = availableVoices.length ? availableVoices : synth.getVoices();
    utterance.voice = voices.find(v => v.name.includes("Google")) ||
                      voices.find(v => v.name.includes("Microsoft")) ||
                      voices.find(v => v.lang === "en-US") ||
                      voices[0];
    utterance.onend = () => {
        isSpeaking = false;
        if (continuousMode && !isListening && !pendingRestart && !userInput.value.trim()) {
            pendingRestart = true;
            setTimeout(() => {
                if (continuousMode && !isListening && !isSpeaking) startListening();
                pendingRestart = false;
            }, 500);
        }
    };
    synth.speak(utterance);
}

// ---------- Enhanced Weather ----------
async function fetchDetailedWeather(location) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (!geoData.results?.length) return null;
        const { latitude, longitude, name } = geoData.results[0];
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relative_humidity_2m,apparent_temperature,precipitation_probability&timezone=auto`;
        const wRes = await fetch(weatherUrl);
        const wData = await wRes.json();
        if (!wData.current_weather) return null;
        const temp = wData.current_weather.temperature;
        const wind = wData.current_weather.windspeed;
        const weatherCode = wData.current_weather.weathercode;
        const humidity = wData.hourly?.relative_humidity_2m?.[0] || "N/A";
        const feelsLike = wData.hourly?.apparent_temperature?.[0] || temp;
        const rainProb = wData.hourly?.precipitation_probability?.[0] || 0;
        let condition = "Clear";
        if (weatherCode >= 51 && weatherCode <= 67) condition = "Drizzle/Rain";
        else if (weatherCode >= 71 && weatherCode <= 77) condition = "Snow";
        else if (weatherCode >= 80 && weatherCode <= 99) condition = "Thunderstorm";
        let clothingTip = temp > 30 ? "Wear light clothes." : (temp < 10 ? "Heavy jacket needed." : "Comfortable.");
        let umbrellaTip = rainProb > 50 ? "Bring an umbrella!" : (rainProb > 20 ? "Maybe an umbrella." : "");
        let travelWarning = wind > 30 ? "Strong winds – be careful." : "";
        const summary = `📍 ${name}: ${temp}°C, feels like ${feelsLike}°C. Humidity ${humidity}%, wind ${wind} km/h, ${condition}. Rain chance ${rainProb}%. ${clothingTip} ${umbrellaTip} ${travelWarning}`;
        return { summary, openUrl: "https://windy.com" };
    } catch(e) { return null; }
}

// ---------- Execute Tool (with popup protection) ----------
async function executeToolCommand(toolObj) {
    const { tool, speak, open: urlToOpen, query } = toolObj;
    if (speak) {
        speakText(speak);
        addMessage(speak, false, { sourceLinks: urlToOpen ? [{ label: `Open ${tool.toUpperCase()}`, url: urlToOpen }] : [] });
    } else {
        addMessage("Action completed.", false);
    }
    if (urlToOpen) {
        setTimeout(() => {
            const newWin = window.open(urlToOpen, '_blank');
            if (!newWin) addSystemMessage("⚠️ Popup blocked. Please allow popups.", true);
        }, 800);
    }
    if (tool === 'weather' && query) {
        let loc = query.replace(/weather|in|for|current/gi, '').trim() || "London";
        const data = await fetchDetailedWeather(loc);
        if (data) {
            addMessage(data.summary, false);
            speakText(data.summary);
        } else addMessage("Weather fetch failed.", false);
    }
    if (tool === 'news') {
        setTimeout(() => window.open('https://www.reuters.com/', '_blank'), 1000);
    }
}

// ---------- LOCAL COMMAND PARSER (bypass AI for speed) ----------
function parseLocalCommand(text) {
    const lower = text.toLowerCase().trim();
    // "open youtube", "open gmail", "open X"
    if (lower.startsWith("open ")) {
        const site = lower.slice(5).trim();
        if (siteMap[site]) {
            const url = siteMap[site];
            executeToolCommand({ tool: "open_site", speak: `Opening ${site}.`, open: url, query: site });
            return true;
        } else {
            // Fallback to Google search
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(site)}`;
            executeToolCommand({ tool: "open_site", speak: `I don't have a direct link for "${site}". Searching Google.`, open: searchUrl, query: site });
            return true;
        }
    }
    // "search cats on youtube"
    if (lower.includes("search") && lower.includes("youtube")) {
        let query = text.replace(/search|on|youtube/gi, '').trim();
        if (query) {
            const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            executeToolCommand({ tool: "youtube", speak: `Searching YouTube for ${query}.`, open: url, query });
            return true;
        }
    }
    // "weather in tokyo" (optional direct weather)
    if (lower.includes("weather")) {
        // Let AI handle detailed weather – but we could also pre‑fetch. Not necessary.
        return false;
    }
    return false;
}

// ---------- STREAMING + JSON + SMART MEMORY ----------
async function askZara(userPrompt) {
    openRouterApiKey = localStorage.getItem('zara_openrouter_key') || '';
    if (!openRouterApiKey.trim()) {
        addSystemMessage("❌ No API key. Please enter your OpenRouter API key.", true);
        speakText("Please set your API key.");
        return;
    }

    // First, check local command (fast path)
    if (parseLocalCommand(userPrompt)) return;

    thinkingIndicator.classList.add('active');
    thinkingTextSpan.innerText = "Zara is thinking...";
    
    // Cancel previous streaming request
    if (abortController) abortController.abort();
    abortController = new AbortController();

    try {
        // --- Smart Memory: last 30 messages + periodic summary ---
        let history = JSON.parse(localStorage.getItem('zara_chat_history') || '[]');
        let recent = history.slice(-30);   // 30 messages context
        // Optional: add a compact summary every 10 messages? For simplicity, we'll keep 30 messages.
        
        const systemPrompt = `You are Zara, a futuristic AI assistant with personality. Be conversational, intelligent, and warm. Remember context, continue naturally. Use tools when helpful. Respond ONLY in valid JSON. Never break JSON format.

Format: {"tool":"weather|news|youtube|wikipedia|google|open_site|none", "speak":"your natural response", "open":"optional url", "query":"optional query"}

Capabilities: open websites (e.g., "open youtube"), search YouTube, Google, fetch weather, continue conversations. For "open_site", if query matches a known site (youtube, gmail, etc.) provide its URL; otherwise fallback to Google search. Weather queries should include location. Keep responses human-like, concise, and helpful.`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...recent.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userPrompt }
        ];

        // Use streaming with response_format json_object
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey.trim()}`,
                "Content-Type": "application/json",
                "HTTP-Referer": window.location.origin,
                "X-Title": "Zara AI Assistant"
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-chat-v3-0324:free",
                messages: messages,
                response_format: { type: "json_object" },  // HUGE: guarantees JSON
                temperature: 0.8,        // more personality
                top_p: 0.95,
                max_tokens: 700,
                stream: true
            }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(data);
                        const chunk = parsed.choices[0]?.delta?.content || '';
                        fullContent += chunk;
                        // Optional: live typing effect – we skip for simplicity but could update a temporary message.
                    } catch(e) {}
                }
            }
        }

        if (!fullContent) throw new Error("Empty response");
        // Clean and parse JSON
        let cleanJson = fullContent.replace(/```json/g, '').replace(/```/g, '').trim();
        let aiJson;
        try {
            const match = cleanJson.match(/\{[\s\S]*\}/);
            aiJson = JSON.parse(match ? match[0] : cleanJson);
        } catch(e) {
            aiJson = { tool: "none", speak: fullContent.substring(0, 300), open: null };
        }

        const validTools = ['weather', 'news', 'youtube', 'wikipedia', 'google', 'open_site', 'none'];
        if (!validTools.includes(aiJson.tool)) aiJson.tool = 'none';

        // Auto-fill URLs
        if (aiJson.tool === 'youtube' && aiJson.query) {
            aiJson.open = `https://www.youtube.com/results?search_query=${encodeURIComponent(aiJson.query)}`;
        } else if (aiJson.tool === 'wikipedia' && aiJson.query) {
            aiJson.open = `https://en.wikipedia.org/wiki/${encodeURIComponent(aiJson.query.replace(/ /g, '_'))}`;
        } else if (aiJson.tool === 'google' && aiJson.query) {
            aiJson.open = `https://www.google.com/search?q=${encodeURIComponent(aiJson.query)}`;
        } else if (aiJson.tool === 'open_site' && aiJson.query) {
            const siteKey = aiJson.query.toLowerCase().trim();
            aiJson.open = siteMap[siteKey] || `https://www.google.com/search?q=${encodeURIComponent(siteKey)}`;
            if (!siteMap[siteKey] && !aiJson.speak) aiJson.speak = `I couldn't find a direct link, so I searched Google for "${siteKey}".`;
        } else if (aiJson.tool === 'weather' && !aiJson.open) aiJson.open = "https://windy.com";
        else if (aiJson.tool === 'news' && !aiJson.open) aiJson.open = "https://reuters.com";

        if (aiJson.tool !== 'none') {
            await executeToolCommand(aiJson);
        } else {
            const reply = aiJson.speak || "I'm here. Ask me anything.";
            addMessage(reply, false);
            speakText(reply);
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error(error);
            addSystemMessage(`❌ AI error: ${error.message}.`, true);
            speakText("Sorry, I encountered an error.");
        }
    } finally {
        thinkingIndicator.classList.remove('active');
        abortController = null;
    }
}

// ---------- Voice Recognition with Stable Auto-restart ----------
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        addSystemMessage("❌ Voice recognition not supported.", true);
        micBtn.disabled = true;
        return null;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = 'en-US';

    recog.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        soundWave.classList.add('active');
        voiceStatusSpan.innerText = "🎤 Listening...";
        aiOrb.style.boxShadow = "0 0 30px #ff3399";
    };
    recog.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        soundWave.classList.remove('active');
        voiceStatusSpan.innerText = "";
        aiOrb.style.boxShadow = "0 0 20px cyan";
        // Stable continuous mode: auto-restart if enabled and not speaking
        if (continuousMode && !isSpeaking && !pendingRestart) {
            pendingRestart = true;
            setTimeout(() => {
                if (continuousMode && !isListening && !isSpeaking && !userInput.value.trim()) {
                    try { recog.start(); } catch(e) {}
                }
                pendingRestart = false;
            }, 400);
        }
    };
    recog.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        voiceStatusSpan.innerText = `🗣️ "${transcript}"`;
        setTimeout(() => voiceStatusSpan.innerText = "", 2000);
        processUserInput(transcript);
    };
    recog.onerror = (e) => {
        console.warn("Speech error", e);
        voiceStatusSpan.innerText = `🎙️ ${e.error}`;
        setTimeout(() => voiceStatusSpan.innerText = "", 1500);
        micBtn.classList.remove('listening');
        soundWave.classList.remove('active');
        isListening = false;
    };
    return recog;
}

function startListening() {
    if (isSpeaking) {
        addSystemMessage("Zara is speaking, please wait...", false);
        return;
    }
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return;
    if (isListening) recognition.stop();
    else recognition.start();
}

async function processUserInput(text) {
    if (!text.trim()) return;
    addMessage(text, true);
    userInput.value = "";
    await askZara(text);
}

// ---------- Event Listeners ----------
sendBtn.addEventListener('click', () => processUserInput(userInput.value));
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') processUserInput(userInput.value); });
micBtn.addEventListener('click', startListening);
continuousModeToggle.addEventListener('change', (e) => {
    continuousMode = e.target.checked;
    if (!continuousMode && isListening) recognition?.stop();
    addSystemMessage(`Continuous mode ${continuousMode ? 'enabled' : 'disabled'}.`, false);
});
saveApiKeyBtn.addEventListener('click', () => {
    let newKey = apiKeyInput.value.trim();
    if (!newKey) { addSystemMessage("❌ Empty key.", true); return; }
    if (!newKey.startsWith("sk-or-")) { addSystemMessage("❌ Invalid key format (must start with sk-or-).", true); return; }
    localStorage.setItem('zara_openrouter_key', newKey);
    openRouterApiKey = newKey;
    addSystemMessage("✅ API key saved.", false);
    speakText("Key saved.");
});

// Load history without duplication
function loadChatHistory() {
    let history = JSON.parse(localStorage.getItem('zara_chat_history') || '[]');
    if (!history.length) return;
    const lastMessages = history.slice(-12);
    chatMessages.innerHTML = '';
    lastMessages.forEach(msg => renderMessage(msg.content, msg.role === 'user'));
    addSystemMessage("🔄 Loaded previous conversation.", false);
}
loadChatHistory();

setTimeout(() => {
    if (openRouterApiKey) speakText("Zara ready. Continuous listening active.");
    else speakText("Please set your API key.");
}, 800);
