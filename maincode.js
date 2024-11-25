const dataUrl = 'https://raw.githubusercontent.com/KingJ23341/AIbot/refs/heads/main/trainingdata.json';
let trainingData = null;
let conversationHistory = [];

async function loadTrainingData() {
  const startTime = performance.now();
  try {
    const response = await fetch(dataUrl);
    const data = await response.json();
    const endTime = performance.now();

    const fetchTime = (endTime - startTime).toFixed(2);
    const sizeInBytes = new TextEncoder().encode(JSON.stringify(data)).length;
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const sizeInMB = (sizeInKB / 1024).toFixed(2);

    trainingData = data;
    appendMessage('System', `Training data loaded in ${fetchTime} ms.`);
    appendMessage('System', `Data size: ${sizeInBytes} bytes (${sizeInKB} KB, ${sizeInMB} MB)`);

  } catch (error) {
    console.error('Error loading training data:', error);
    appendMessage('System', 'Failed to load training data.');
  }
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
}

function getResponse(userInput) {
  if (!trainingData) {
    return "I'm still loading. Please wait!";
  }

  // Check if the input is a basic math operation (like 2 + 2 or 3 * 3)
  if (userInput.match(/^\d+\s*[\+\-\*\/]\s*\d+$/)) {
    try {
      return eval(userInput);  // Calculate the math expression
    } catch (error) {
      return "Sorry, I couldn't calculate that.";
    }
  }

  // Check if the input is asking to count
  const countMatch = userInput.match(/count\s*(to|down|from)\s*(\d+)(\s*(to|from)\s*(\d+))?/i);
  if (countMatch) {
    const direction = countMatch[1].toLowerCase();
    let start = parseInt(countMatch[2]);
    let end = countMatch[5] ? parseInt(countMatch[5]) : start;

    if (direction === "to" || direction === "from") {
      return countUp(start, end);
    } else if (direction === "down") {
      return countDown(start, 0);
    }
  }

  // Check if the input is asking to pick a random number
  const randomNumberMatch = userInput.match(/pick a random number(?: from (\d+) to (\d+))?/i);
  if (randomNumberMatch) {
    const start = randomNumberMatch[1] ? parseInt(randomNumberMatch[1]) : 0;
    const end = randomNumberMatch[2] ? parseInt(randomNumberMatch[2]) : Number.MAX_SAFE_INTEGER;
    return pickRandomNumber(start, end);
  }

  // Handle conversation samples and randomly select responses for duplicates like jokes
  const inputTokens = tokenize(userInput);
  let bestMatch = null;
  let maxOverlap = 0;

  const matchedSamples = trainingData.conversationsamples.filter((sample) => {
    const botTokens = tokenize(sample.user);
    return botTokens.every(token => inputTokens.includes(token));
  });

  if (matchedSamples.length > 0) {
    const randomSample = matchedSamples[Math.floor(Math.random() * matchedSamples.length)];
    bestMatch = randomSample.bot;
  }

  // Use training data if no match found
  if (!bestMatch) {
    trainingData.traineddata.forEach((data) => {
      const overlap = data.toLowerCase().split(' ').filter((word) => inputTokens.includes(word)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = data;
      }
    });
  }

  return bestMatch || "I don't understand that. Can you rephrase?";
}

function pickRandomNumber(start, end) {
  if (isNaN(start) || isNaN(end)) return "Please provide valid numbers.";
  if (start > end) return "The start number must be less than or equal to the end number.";
  
  const randomNum = Math.floor(Math.random() * (end - start + 1)) + start;
  return randomNum;
}

function countUp(start, end) {
  if (isNaN(start) || isNaN(end)) return "Please provide valid numbers.";
  if (start > end) return "The start number must be less than or equal to the end number.";
  let count = '';
  for (let i = start; i <= end; i++) {
    count += i + ' ';
  }
  return count.trim();
}

function countDown(start, end) {
  if (isNaN(start) || isNaN(end)) return "Please provide valid numbers.";
  if (start < end) return "The start number must be greater than or equal to the end number.";
  let count = '';
  for (let i = start; i >= end; i--) {
    count += i + ' ';
  }
  return count.trim();
}

function appendMessage(sender, message) {
  const chatWindow = document.getElementById('chat-window');
  const p = document.createElement('p');
  p.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatWindow.appendChild(p);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function refreshTrainingData() {
  appendMessage('System', 'Refreshing training data...');
  loadTrainingData();
}

function updateTrainingExport() {
  const exportContainer = document.getElementById('export-text');
  const newConversationSamples = trainingData.conversationsamples.map(sample => 
    `{
  "user": "${sample.user}",
  "bot": "${sample.bot}"
}`).join('\n\n');

  exportContainer.textContent = newConversationSamples;
}

async function handleMessage() {
  const userInput = document.getElementById('user-input').value.trim();
  if (!userInput) return;

  appendMessage('You', userInput);
  appendMessage('Bot', '...typing...');

  // Simulate response delay
  setTimeout(() => {
    const chatWindow = document.getElementById('chat-window');
    const inquiries = userInput.split(/,?\s+and\s+/); // Split input by "and" to handle multiple inquiries
    let response = '';

    inquiries.forEach((inquiry, index) => {
      response += getResponse(inquiry) + (index < inquiries.length - 1 ? ' ' : '' );
    });

    // Update the last message in the chat window after response generation
    chatWindow.lastChild.innerHTML = `<strong>Bot:</strong> ${response}`;
    document.getElementById('user-input').value = '';

    // Push both user input and bot response into the conversation history
    conversationHistory.push({ user: userInput, bot: response });

    // If bot doesn't understand the query, ask for user input to improve training data
    if (response === "I don't understand that. Can you rephrase?") {
      let userInputForTraining = prompt("How should the bot respond to this message?");
      if (userInputForTraining) {
        appendMessage('System', `Adding response to training data: ${userInputForTraining}`);
        const index = trainingData.conversationsamples.findIndex(sample => sample.user === userInput);
        if (index === -1) {
          trainingData.conversationsamples.push({
            user: userInput,
            bot: userInputForTraining
          });
        } else {
          trainingData.conversationsamples[index].bot = userInputForTraining;
        }
        updateTrainingExport();
      }
    }
  }, 1000);
}

function exportConversations() {
  const exportContainer = document.getElementById('export-text');
  const filteredConversations = conversationHistory.filter(conv => conv.user && conv.bot);
  const exportData = filteredConversations.map(conv => 
    `{
  "user": "${conv.user}",
  "bot": "${conv.bot}"
}`).join(',\n'); // Adding a comma between objects

  exportContainer.textContent = `{
"conversationsamples": [
${exportData}
]
}`;
}

// Event Listeners
document.getElementById('send-btn').addEventListener('click', handleMessage);
document.getElementById('user-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleMessage();
});
document.getElementById('refresh-btn').addEventListener('click', refreshTrainingData);
document.getElementById('export-btn').addEventListener('click', exportConversations);

// Load training data on start
loadTrainingData();
