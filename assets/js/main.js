const fixedWidth = document.getElementById("area").offsetWidth;
const fixedHeight = document.getElementById("area").offsetHeight;
let isFullScreen = false;
let loadedMasterBoard = false;
let keyPressed = false;

let saveData = {
  drawnBingoBalls: [],
  themeColor: "classic",
  bingoStyle: "ball",
  blockerEnabled: false,
  lastActionWasRemove: false,
  ballsDrawnRemaining: "hidden",
  hiddenBingoLetters: [],
  winningPattern: [],
  firstRun: 0,
  voice: "Daniel",
  completedLetters: [],
  lastVoice: "Daniel",
  currentPatternName: "No Pattern",
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 0.8,
  scriptPresets: {},
  currentScriptPreset: "Default",
  bingosWonInRound: 0
}

const namedPatterns = {
  "Four Corners": [1,5,21,25],
  "Top Hat": [5,7,8,9,10,12,13,14,15,17,18,19,20,25],
  "Letter L": [1,2,3,4,5,10,15,20,25],
  "Frame Inside": [7,8,9,12,14,17,18,19],
  "Tree": [3,7,8,11,12,13,14,15,17,18,23],
  "Letter T": [1,6,11,12,13,14,15,16,21],
  "Frame Outside": [1,2,3,4,5,6,10,11,15,16,20,21,22,23,24,25],
  "Field Goal": [1,2,3,8,11,13,14,15,18,21,22,23],
  "Letter X": [1,5,7,9,13,17,19,21,25],
  "Plus Sign": [3,8,11,12,13,14,15,18,23],
  "Diamond": [3,7,9,11,15,17,19,23],
  "Letter Y": [1,7,13,14,15,17,21],
  "Lucky 7": [1,5,6,9,11,13,16,17,21],
  "Blackout": Array.from({length: 25}, (_, i) => i + 1)
};

const SPEECH_PARAMS = {
  rate: 1.2,
  pitch: 1,
  volume: 0.8
};

let speechQueue = [];
let speechQueueBusy = false;
let speechQueueTimer = null;
let speechEngineWarmedUp = false;
let speechWarmupInFlight = false;
let speechWarmupWatchdog = null;

function clearSpeechQueue() {
  speechQueue = [];
  speechQueueBusy = false;
  if (speechQueueTimer) {
    clearTimeout(speechQueueTimer);
    speechQueueTimer = null;
  }
  if (speechWarmupWatchdog) {
    clearTimeout(speechWarmupWatchdog);
    speechWarmupWatchdog = null;
  }
}

function scheduleNextSpeech(delayMs = 40) {
  if (speechQueueTimer) {
    clearTimeout(speechQueueTimer);
  }
  speechQueueTimer = setTimeout(processSpeechQueue, delayMs);
}

function warmUpSpeechEngine() {
  if (!('speechSynthesis' in window) || saveData.voice === 'off' || speechWarmupInFlight || speechEngineWarmedUp) {
    return;
  }
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending || speechQueueBusy) {
    return;
  }
  speechWarmupInFlight = true;
  const warmup = new SpeechSynthesisUtterance(' ');
  warmup.rate = 1;
  warmup.pitch = 1;
  warmup.volume = 0;
  setVoice(warmup);
  speechQueueBusy = true;

  if (speechWarmupWatchdog) {
    clearTimeout(speechWarmupWatchdog);
  }
  // iOS can occasionally swallow onend/onerror for silent utterances.
  // Fail open after a short delay so speech is never stuck muted.
  speechWarmupWatchdog = setTimeout(function() {
    speechEngineWarmedUp = true;
    speechWarmupInFlight = false;
    speechQueueBusy = false;
    speechWarmupWatchdog = null;
    scheduleNextSpeech(0);
  }, 1200);

  warmup.onend = function() {
    if (speechWarmupWatchdog) {
      clearTimeout(speechWarmupWatchdog);
      speechWarmupWatchdog = null;
    }
    speechEngineWarmedUp = true;
    speechWarmupInFlight = false;
    speechQueueBusy = false;
    scheduleNextSpeech(0);
  };
  warmup.onerror = function() {
    if (speechWarmupWatchdog) {
      clearTimeout(speechWarmupWatchdog);
      speechWarmupWatchdog = null;
    }
    // Fail open so a warm-up error does not permanently block announcements.
    speechEngineWarmedUp = true;
    speechWarmupInFlight = false;
    speechQueueBusy = false;
    scheduleNextSpeech(0);
  };
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  window.speechSynthesis.speak(warmup);
}

function primeSpeechOnFirstInteraction() {
  if (!('speechSynthesis' in window)) return;
  const tryWarm = function() {
    if (saveData.voice !== 'off') {
      warmUpSpeechEngine();
    }
    document.removeEventListener('pointerdown', tryWarm, true);
    document.removeEventListener('touchstart', tryWarm, true);
    document.removeEventListener('keydown', tryWarm, true);
  };
  document.addEventListener('pointerdown', tryWarm, true);
  document.addEventListener('touchstart', tryWarm, true);
  document.addEventListener('keydown', tryWarm, true);
}

function processSpeechQueue() {
  speechQueueTimer = null;
  if (!('speechSynthesis' in window) || saveData.voice === 'off') {
    clearSpeechQueue();
    return;
  }
  if (speechQueueBusy || speechQueue.length === 0) {
    return;
  }
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    scheduleNextSpeech(10);
    return;
  }
  if (!speechEngineWarmedUp) {
    warmUpSpeechEngine();
    if (speechWarmupInFlight) {
      return;
    }
  }
  const text = speechQueue.shift();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language || 'en-US';
  utterance.rate = saveData.speechRate;
  utterance.pitch = saveData.speechPitch;
  utterance.volume = saveData.speechVolume;
  setVoice(utterance);
  speechQueueBusy = true;
  utterance.onend = function() {
    speechQueueBusy = false;
    scheduleNextSpeech(0);
  };
  utterance.onerror = function() {
    speechQueueBusy = false;
    scheduleNextSpeech(0);
  };
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  window.speechSynthesis.speak(utterance);
}

if(supportsLocalStorage) {
  if (localStorage.getItem("bingoMasterBoardSaveData")) {
    const parsedData = JSON.parse(localStorage.getItem("bingoMasterBoardSaveData"));
    for (let i = 0; i < Object.keys(parsedData).length; i += 1) {
      if (saveData.hasOwnProperty(Object.getOwnPropertyNames(parsedData)[i])) {
        saveData[Object.keys(saveData)[Object.keys(saveData).indexOf(Object.getOwnPropertyNames(parsedData)[i])]]
        = parsedData[Object.keys(parsedData)[i]];
      }
    }
  }
}
if (saveData.voice && saveData.voice !== 'off') {
  saveData.lastVoice = saveData.voice;
}

function save() {
  if (supportsLocalStorage) {
    localStorage.setItem('bingoMasterBoardSaveData', JSON.stringify(saveData));
  }
}

function init() {
	resize();
	window.addEventListener('resize', resize);
	document.addEventListener("fullscreenchange", onFullScreenChange, false);
	document.addEventListener("webkitfullscreenchange", onFullScreenChange, false);
	const bingoBallClass = document.querySelectorAll(".bingoBall");
	for (let i = 0; i < bingoBallClass.length; i+=1) {
		bingoBallClass[i].addEventListener("click", function() {activateBingoBall(i+1)});
	}
  let param = location.search;
  if (saveData.firstRun === 0 && supportsLocalStorage) {
    saveData.firstRun = 1;
    saveData.ballsDrawnRemaining = 'hidden';
    saveData.currentScriptPreset = 'Default';
    saveData.voice = 'Daniel';
    saveData.lastVoice = 'Daniel';
    loadDefaultScripts();
    save();
  }
  setTimeout(function() {
    hide("titleSlide");
    show("fullScreenToggleLayer");
		show("masterBoardSlide", "grid");
	},50);
  document.onkeyup = function() {
    keyPressed = false;
  }
  const img1 = new Image();
  const img2 = new Image();
  const img3 = new Image();
  img1.src = "./assets/img/fullscreenUpHover.svg";
  img2.src = "./assets/img/fullscreenDownHover.svg";
  img3.src = "./assets/img/homeButtonHover.svg";
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = updateVoiceOptions;
    updateVoiceOptions();
    primeSpeechOnFirstInteraction();
  }
  updateVoiceIcon();
  updateBoardToggleIcon();
}

function updateVoiceIcon() {
  const icon = document.getElementById('voiceToggle');
  if (icon) {
    if (saveData.voice === 'off') {
      icon.src = './assets/img/voiceOff.svg';
    } else {
      icon.src = './assets/img/voiceOn.svg';
    }
  }
}

function updateBoardToggleIcon() {
  const icon = document.getElementById('boardToggleIcon');
  if (!icon) return;
  icon.classList.remove('board-shown', 'board-hidden');
  if (saveData.blockerEnabled === true) {
    icon.classList.add('board-hidden');
  } else {
    icon.classList.add('board-shown');
  }
}

function toggleVoice() {
  if (saveData.voice === 'off') {
    saveData.voice = saveData.lastVoice || 'voice0';
    speechEngineWarmedUp = false;
    speechWarmupInFlight = false;
  } else {
    saveData.lastVoice = saveData.voice;
    saveData.voice = 'off';
    clearSpeechQueue();
    speechWarmupInFlight = false;
    window.speechSynthesis.cancel();
  }
  save();
  updateVoiceIcon();
}

function showKeyboardShortcuts() {
  document.getElementById('keyboardShortcutsOverlay').style.display = 'flex';
}

function hideKeyboardShortcuts() {
  document.getElementById('keyboardShortcutsOverlay').style.display = 'none';
}

function showAdvancedSpeech() {
  document.getElementById('speechRate').value = saveData.speechRate;
  document.getElementById('speechPitch').value = saveData.speechPitch;
  document.getElementById('rateValue').textContent = saveData.speechRate.toFixed(1);
  document.getElementById('pitchValue').textContent = saveData.speechPitch.toFixed(1);
  document.getElementById('advancedSpeechOverlay').style.display = 'flex';
}

function hideAdvancedSpeech() {
  document.getElementById('advancedSpeechOverlay').style.display = 'none';
}

function updateRateLabel(value) {
  document.getElementById('rateValue').textContent = parseFloat(value).toFixed(1);
}

function updatePitchLabel(value) {
  document.getElementById('pitchValue').textContent = parseFloat(value).toFixed(1);
}

function resetAdvancedSpeech() {
  document.getElementById('speechRate').value = 1;
  document.getElementById('speechPitch').value = 1;
  document.getElementById('rateValue').textContent = '1.0';
  document.getElementById('pitchValue').textContent = '1.0';
}

function saveAdvancedSpeech() {
  const rate = parseFloat(document.getElementById('speechRate').value);
  const pitch = parseFloat(document.getElementById('speechPitch').value);
  if (!isNaN(rate)) saveData.speechRate = rate;
  if (!isNaN(pitch)) saveData.speechPitch = pitch;
  save();
  hideAdvancedSpeech();
}

function testAdvancedSpeech() {
  const originalRate = saveData.speechRate;
  const originalPitch = saveData.speechPitch;
  const rate = parseFloat(document.getElementById('speechRate').value);
  const pitch = parseFloat(document.getElementById('speechPitch').value);
  if (!isNaN(rate)) saveData.speechRate = rate;
  if (!isNaN(pitch)) saveData.speechPitch = pitch;
  speak('B 15');
  saveData.speechRate = originalRate;
  saveData.speechPitch = originalPitch;
}

function showScriptOverlay() {
  updateScriptPresetDropdown();
  initializeScriptGrid();
  document.getElementById('scriptOverlay').style.display = 'flex';
}

function hideScriptOverlay() {
  document.getElementById('scriptOverlay').style.display = 'none';
}

function isFormFieldFocused(e) {
  const tagName = e.target && e.target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function handleGlobalKeyEvents(e) {
  // Don't process shortcuts if user is typing in an input field
  if (isFormFieldFocused(e)) {
    return false;
  }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
    showKeyboardShortcuts();
    e.preventDefault();
    return true;
  }
  if (e.key === 'Escape') {
    if (document.getElementById('advancedSpeechOverlay').style.display === 'flex') {
      hideAdvancedSpeech();
      e.preventDefault();
      return true;
    }
    if (document.getElementById('scriptOverlay').style.display === 'flex') {
      hideScriptOverlay();
      e.preventDefault();
      return true;
    }
    if (document.getElementById('scriptEditorOverlay').style.display === 'flex') {
      closeScriptEditor();
      e.preventDefault();
      return true;
    }
  }
  return false;
}

function updateVoiceOptions() {
  const voices = speechSynthesis.getVoices();
  const select = document.getElementById('voiceSelect');
  if (!select) return;
  select.innerHTML = '';
  // Add Off
  const offOption = document.createElement('option');
  offOption.value = 'off';
  offOption.textContent = 'Off';
  select.appendChild(offOption);
  // Add voices matching browser language (unique names). Use the actual voices[] index
  // as the option value (prefix with 'voice') so we can consistently
  // set the utterance.voice by index later.
  // Collect voices matching browser language with their original index, dedupe by name,
  // then sort alphabetically (case-insensitive) before populating.
  const browserLang = ((typeof navigator !== 'undefined' && navigator.language) || 'en').split('-')[0];
  const entries = [];
  voices.forEach(function(voice, i) {
    if (voice.lang && voice.lang.startsWith(browserLang)) {
      const cleanName = voice.name.split(' (')[0];
      entries.push({ name: cleanName, index: i });
    }
  });
  // Dedupe by name, keeping the first occurrence
  const seen = new Set();
  const deduped = [];
  for (const e of entries) {
    if (!seen.has(e.name)) {
      seen.add(e.name);
      deduped.push(e);
    }
  }
  deduped.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  deduped.forEach(function(item) {
    const option = document.createElement('option');
    option.value = 'voice' + item.index;
    option.textContent = item.name;
    select.appendChild(option);
  });

  // Normalize legacy/name-based voice values (e.g. "Daniel") into indexed values.
  if (saveData.voice && saveData.voice !== 'off' && typeof saveData.voice === 'string' && !saveData.voice.startsWith('voice')) {
    const targetName = saveData.voice.split(' (')[0].toLowerCase();
    for (const item of deduped) {
      if (item.name.toLowerCase().startsWith(targetName)) {
        saveData.voice = 'voice' + item.index;
        saveData.lastVoice = saveData.voice;
        save();
        break;
      }
    }
  }
}

function resize() {
  const viewNames = [
    document.getElementById("area"),
  	document.getElementById("fader"),
		document.getElementById("fullScreenToggleLayer"),
		document.getElementById("drawBallLayer")
  ];
  let areaMultiplier = viewNames[0].offsetHeight/viewNames[0].offsetWidth;
  let windowMultiplier = window.innerHeight/window.innerWidth;
  if (windowMultiplier < areaMultiplier) { // window is wider
    for (let i = 0; i<viewNames.length; i+=1) {
        viewNames[i].style.transform = 'scale(' + (window.innerHeight/fixedHeight) + ')';
    }
  } else {
    for (let i = 0; i<viewNames.length; i+=1) {
      viewNames[i].style.transform = 'scale(' + (window.innerWidth/fixedWidth) + ')';
    }
  }
}

function onFullScreenChange() {
  var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
  if (fullscreenElement === null || fullscreenElement === undefined) {
    isFullScreen = false;
  } else {
    isFullScreen = true;
  }
  changeFullScreenImg();
}

function show(elementName, display) {
  document.getElementById("fader").classList.add("notransition");
  document.getElementById("fader").style.opacity = "1";
	if (display === "flex") {
	  document.getElementById(elementName).style.display = "flex";
	} else if (display === "grid") {
	  document.getElementById(elementName).style.display = "grid";
	} else {
	  document.getElementById(elementName).style.display = "block";
	}
	if (elementName === "masterBoardSlide") {
		changeBG(saveData.themeColor);
		document.getElementById("drawBallLayer").style.display = "block";
		document.getElementById("fullScreenToggle").classList.add("fullScreenToggleSmall");
		document.getElementById("homeButton").style.display = "block";
		document.getElementById("fullScreenToggleLayer").style.display = "block";
    if (loadedMasterBoard === false) {
      setUpMasterBoard();
      loadedMasterBoard = true;
    }
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      // Don't intercept keyboard input in form fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === ' ') {randomDraw();}
        else if (e.key === 'r') {resetBoard();}
        else if (e.key === 'b') {hideBingo('B', 'toggle');}
        else if (e.key === 'i') {hideBingo('I', 'toggle');}
        else if (e.key === 'n') {hideBingo('N', 'toggle');}
        else if (e.key === 'g') {hideBingo('G', 'toggle');}
        else if (e.key === 'o') {hideBingo('O', 'toggle');}
        else if (e.key === 't') {hide('masterBoardSlide');show('settingsSlide', 'grid');}
        else if (e.key === 'c') {showScriptOverlay();}
        else if (e.key === 'w') {hide('masterBoardSlide');show('winningPatternSlide', 'grid');}
        else if (e.key === 'v') {toggleBallsDrawnRemaining('toggle');}
        else if (e.key === 's') {toggleVoice();}
        else if (e.key === 'h') {hide('masterBoardSlide');show('titleSlide');}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
	}
  else if (elementName === "settingsSlide") {
    setUpSettings(saveData.themeColor);
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      // Don't intercept keyboard input in form fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 't' || e.key === 'Enter') {hide('settingsSlide');show('masterBoardSlide', 'grid');}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
  }
  else if (elementName === "winningPatternSlide") {
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 'w' || e.key === 'Enter') {hideBingoLettersBasedOnWinningPattern();hide('winningPatternSlide');show('masterBoardSlide', 'grid');}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
  }
  else if (elementName === "titleSlide") {
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 'Enter') {hide('titleSlide');show('masterBoardSlide', 'grid');}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
  }
  else if (elementName === "howToUseSlide") {
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 'ArrowLeft') {keyboardNavHowToUse(0);}
        else if (e.key === 'ArrowRight') {keyboardNavHowToUse(1);}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Enter') {hide('howToUseSlide');show('titleSlide');}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
  }
  else if (elementName === "aboutCreditsSlide") {
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 'ArrowLeft') {keyboardNavCredits(0);}
        else if (e.key === 'ArrowRight') {keyboardNavCredits(1);}
        else if (e.key === 'f') {toggleFullScreen();}
        else if (e.key === 'Enter') {hide('aboutCreditsSlide');show('titleSlide');}
        else if (e.key === 'Escape') {hideKeyboardShortcuts();}
      }
    }
  }
  else {
    document.onkeydown = function(e) {
      if (handleGlobalKeyEvents(e)) return;
      if(!keyPressed) {
        e.preventDefault();
        keyPressed = true;
        if (e.key === 'f') {toggleFullScreen();}
      }
    }
  }
	setTimeout(function() {
	  document.getElementById("fader").classList.remove("notransition");
	  document.getElementById("fader").style.opacity = "0";
	},50);
}

function hide(elementName) {
  document.getElementById(elementName).style.display = "none";
	if (elementName === "masterBoardSlide") {
    changeBG(saveData.themeColor);
		document.getElementById("drawBallLayer").style.display = "none";
		document.getElementById("fullScreenToggle").classList.remove("fullScreenToggleSmall");
		document.getElementById("homeButton").style.display = "none";
		document.getElementById("fullScreenToggleLayer").style.display = "none";
	}
}

function toggleFullScreen(event) {
	const canvas = document.body;
	if (isFullScreen === false) {
		if(canvas.requestFullscreen) {
			canvas.requestFullscreen();
		} else if(canvas.webkitRequestFullscreen) {
			canvas.webkitRequestFullscreen();
		}
		isFullScreen = true;
	}
	else if (isFullScreen === true) {
		if(document.exitFullscreen) {
	  		document.exitFullscreen();
			} else if(document.webkitExitFullscreen) {
	  		document.webkitExitFullscreen();
			}
		isFullScreen = false;
	}
	changeFullScreenImg();
}

function changeFullScreenImg() {
  if (isFullScreen === false) {
    document.getElementById("fullScreenButton").style.display = "block";
    document.getElementById("fullScreenButtonDown").style.display = "none";
  } else {
    document.getElementById("fullScreenButton").style.display = "none";
    document.getElementById("fullScreenButtonDown").style.display = "block";
  }
}

function changeBG(color) {
  let newColor;
  // Remove greyscale classes from letters
  const letters = ['bingoB', 'bingoI', 'bingoN', 'bingoG', 'bingoO'];
  letters.forEach(letterId => {
    const elem = document.getElementById(letterId);
    if (elem && elem.parentElement) {
      elem.parentElement.classList.remove('bingoLetterGreyscale');
    }
  });
  
  if (color === "classic") {
    newColor = "#d1cc85";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#c4bd97, #948A54)";
  } else if (color === "red") {
    newColor = "rgb(220, 100, 100)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#d96459, #c62828)";
  } else if (color === "green") {
    newColor = "rgb(150, 206, 129)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#a9c571, #77933c)";
  } else if (color === "blue") {
    newColor = "rgb(139, 199, 226)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#9abce6, #558ed5)";
  } else if (color === "purple") {
    newColor = "rgb(189, 176, 216)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#b3a2c7, #725892)";
  } else if (color === "orange") {
    newColor = "rgb(255, 200, 130)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#f0b070, #d87a25)";
  } else if (color === "yellow") {
    newColor = "rgb(255, 245, 157)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#f5e79e, #d4c45a)";
  } else if (color === "pink") {
    newColor = "rgb(255, 182, 193)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#ffb6c1, #ff69b4)";
  } else if (color === "teal") {
    newColor = "rgb(128, 203, 196)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#80cbc4, #00897b)";
  } else if (color === "greyscale") {
    newColor = "rgb(180, 180, 180)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#b8b8b8, #6e6e6e)";
    // Apply greyscale to letters
    letters.forEach(letterId => {
      const elem = document.getElementById(letterId);
      if (elem && elem.parentElement) {
        elem.parentElement.classList.add('bingoLetterGreyscale');
      }
    });
  } else {
    newColor = "radial-gradient(#f7eaab, #bfbb73)";
  }
	document.getElementById("area").style.background=newColor;
	document.getElementById("fader").style.background=newColor;
}

function setBigBingoBall(typeOfBingoBall, typeOfBingoBallLetter, bingoIDNum) {
  const bigBall = document.getElementById("bigBingoBall");
  bigBall.classList.remove(bigBall.classList.item(1));
  if (saveData.bingoStyle === "ball") {
    // Convert small ball class to big ball class
    const bigBallClass = typeOfBingoBall.replace("bingoBallBall", "bigBingoBallBall");
    bigBall.classList.add(bigBallClass);
  } else {
    bigBall.classList.add("bigBingoBallVintage");
  }
  document.getElementById("bigBingoLetter").innerHTML = typeOfBingoBallLetter;
  document.getElementById("bigBingoNumber").innerHTML = bingoIDNum;
}

function clearBigBingoBall() {
  document.getElementById("bigBingoBall").classList.remove(document.getElementById("bigBingoBall").classList.item(1));
  document.getElementById("bigBingoLetter").innerHTML = "&nbsp;";
  document.getElementById("bigBingoNumber").innerHTML = "&nbsp;";
}

function activateBingoBall(bingoIDNum) {
  let typeOfBingoBall = typeOfBingo(bingoIDNum);
  let typeOfBingoBallLetter = typeOfBingoLetter(bingoIDNum);
  let bingoID = bingoIDNum + "bingo";
	if (saveData.drawnBingoBalls.indexOf(bingoIDNum) === -1) {
		const ballElement = document.getElementById(bingoID);
		ballElement.classList.add(typeOfBingoBall);
		
		// Trigger animation
		ballElement.classList.remove('animate');
		void ballElement.offsetWidth; // Force reflow
		ballElement.classList.add('animate');
		
    setBigBingoBall(typeOfBingoBall, typeOfBingoBallLetter, bingoIDNum);
    document.getElementById("bigBingoNumber").style.fontSize=104+"px";
    setTimeout(function() {
      document.getElementById("bigBingoNumber").style.fontSize=95+"px";
    },100);
    saveData.drawnBingoBalls.push(bingoIDNum);
    saveData.lastActionWasRemove = false;
    save();
    // Use custom script if defined, otherwise construct default letter + number announcement
    const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
    if (currentPreset[bingoIDNum]) {
      speak(getScriptForBall(bingoIDNum));
    } else {
      speak(typeOfBingoBallLetter + " " + bingoIDNum);
    }
    let counts = getBallCounts();
    if (document.getElementById("ballsDrawnRemaining").style.visibility === "visible") {
      if (saveData.ballsDrawnRemaining === "drawn") {
        speak(counts.drawn + " drawn");
      } else if (saveData.ballsDrawnRemaining === "remaining") {
        speak(counts.remaining + " remaining");
      }
    }
    if (isLetterComplete(typeOfBingoBallLetter) && saveData.completedLetters.indexOf(typeOfBingoBallLetter) === -1) {
      saveData.completedLetters.push(typeOfBingoBallLetter);
      save();
      speak("Letter " + typeOfBingoBallLetter + " is all complete");
      
      // Check if all letters are now complete
      if (saveData.completedLetters.length === 5) {
        speak("Bingo was his name-o");
      }
    }
	} else {
		speak("removing " + typeOfBingoBallLetter + " " + bingoIDNum);
		document.getElementById(bingoID).classList.remove(typeOfBingoBall);
    clearBigBingoBall();
    saveData.drawnBingoBalls.splice(saveData.drawnBingoBalls.indexOf(bingoIDNum), 1);
    saveData.lastActionWasRemove = true;
    save();
    if (!isLetterComplete(typeOfBingoBallLetter)) {
      const index = saveData.completedLetters.indexOf(typeOfBingoBallLetter);
      if (index !== -1) {
        saveData.completedLetters.splice(index, 1);
        save();
        speak("Letter " + typeOfBingoBallLetter + " is no longer complete");
      }
    }
	}
  updateBallStats();
}

function speak(text) {
  if ('speechSynthesis' in window && saveData.voice !== 'off') {
    const normalizedText = String(text || '').trim();
    if (normalizedText.length === 0) return;
    speechQueue.push(normalizedText);
    processSpeechQueue();
  }
}

function setVoice(utterance) {
  const voices = speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;
  // First, support the new stored format 'voice<index>' which references
  // the voices[] index. If that isn't present, fall back to matching by
  // voice name (legacy saved values or other cases).
  if (saveData.voice && typeof saveData.voice === 'string') {
    if (saveData.voice.startsWith('voice')) {
      const index = parseInt(saveData.voice.slice(5));
      if (!Number.isNaN(index) && voices[index]) {
        utterance.voice = voices[index];
        return;
      }
    }
    // Fallback: try to match by name (case-insensitive, prefix match)
    const targetName = saveData.voice.split(' (')[0].toLowerCase();
    for (const v of voices) {
      if (v.name && v.name.toLowerCase().startsWith(targetName)) {
        utterance.voice = v;
        return;
      }
    }
  }
}

function typeOfBingo(num) {
  if (saveData.bingoStyle === "vintage") {
    return "bingoBallVintageActive";
  } else {
    if (saveData.themeColor === "greyscale") {
      return "bingoBallBallActiveGrey";
    }
    if (num <= 15){
      return "bingoBallBallActiveB";
    } else if (num <= 30) {
      return "bingoBallBallActiveI";
    } else if (num <= 45) {
      return "bingoBallBallActiveN";
    } else if (num <= 60) {
      return "bingoBallBallActiveG";
    } else {
      return "bingoBallBallActiveO";
    }
  }
}

function typeOfBingoLetter(num) {
  if (num <= 15){
    return "B";
  } else if (num <= 30) {
    return "I";
  } else if (num <= 45) {
    return "N";
  } else if (num <= 60) {
    return "G";
  } else {
    return "O";
  }
}

function isLetterComplete(letter) {
  let start, end;
  if (letter === 'B') { start = 1; end = 15; }
  else if (letter === 'I') { start = 16; end = 30; }
  else if (letter === 'N') { start = 31; end = 45; }
  else if (letter === 'G') { start = 46; end = 60; }
  else if (letter === 'O') { start = 61; end = 75; }
  for (let i = start; i <= end; i++) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1) return false;
  }
  return true;
}

function loadBingoBall(bingoIDNum) {
  let typeOfBingoBall = typeOfBingo(bingoIDNum);
  let bingoID = bingoIDNum + "bingo";
		document.getElementById(bingoID).classList.add(typeOfBingoBall);
  if (saveData.drawnBingoBalls.indexOf(bingoIDNum) === saveData.drawnBingoBalls.length-1 && saveData.lastActionWasRemove === false) {
    let typeOfBingoBallLetter = typeOfBingoLetter(bingoIDNum);
    setBigBingoBall(typeOfBingoBall, typeOfBingoBallLetter, bingoIDNum);
  }
}

function renderBingoStyle() {
  if (saveData.bingoStyle === "ball") {
    for (let i=0;i<75;i+=1) {
      document.getElementById(i+1 + "bingo").classList.remove(document.getElementById(i+1 + "bingo").classList.item(2));
      document.getElementById(i+1 + "bingo").classList.remove(document.getElementById(i+1 + "bingo").classList.item(1));
      document.getElementById(i+1 + "bingo").classList.add("bingoBallBall");
    }
  } else {
    for (let i=0;i<75;i+=1) {
      document.getElementById(i+1 + "bingo").classList.remove(document.getElementById(i+1 + "bingo").classList.item(2));
      document.getElementById(i+1 + "bingo").classList.remove(document.getElementById(i+1 + "bingo").classList.item(1));
      document.getElementById(i+1 + "bingo").classList.add("bingoBallVintage");
    }
  }
}

function changeBingoStyle(theStyle) {
  saveData.bingoStyle = theStyle;
  save();
  renderBingoStyle();
  for (let i=0;i<saveData.drawnBingoBalls.length;i+=1) {
    loadBingoBall(saveData.drawnBingoBalls[i]);
  }
  setUpSettings();
}

function getBallCounts() {
  let ballsRemaining = getBallsRemaining().length;
  let ballsDrawn = 75 - (saveData.hiddenBingoLetters.length * 15) - ballsRemaining;
  return { drawn: ballsDrawn, remaining: ballsRemaining };
}

function getBallsRemaining() {
  let numbersAvailable = [];
  for (let i = 1; i<=15;i+=1) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1 && saveData.hiddenBingoLetters.indexOf("B") === -1) {
      numbersAvailable.push(i);
    }
  }
  for (let i = 16; i<=30;i+=1) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1 && saveData.hiddenBingoLetters.indexOf("I") === -1) {
      numbersAvailable.push(i);
    }
  }
  for (let i = 31; i<=45;i+=1) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1 && saveData.hiddenBingoLetters.indexOf("N") === -1) {
      numbersAvailable.push(i);
    }
  }
  for (let i = 46; i<=60;i+=1) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1 && saveData.hiddenBingoLetters.indexOf("G") === -1) {
      numbersAvailable.push(i);
    }
  }
  for (let i = 61; i<=75;i+=1) {
    if (saveData.drawnBingoBalls.indexOf(i) === -1 && saveData.hiddenBingoLetters.indexOf("O") === -1) {
      numbersAvailable.push(i);
    }
  }
  return numbersAvailable;
}

function randomDraw() {
  if (getBallsRemaining().length === 0) {
    document.getElementById("drawBallDiv").style.transform = "rotate(15deg)";
    setTimeout(function() {
      document.getElementById("drawBallDiv").style.transform = "rotate(0deg)";
    },100);
  } else {
    document.getElementById("drawBallDiv").style.transform = "scale(0.9)";
    document.getElementById("drawBallDiv").style.opacity = 0.6;
    setTimeout(function() {
      document.getElementById("drawBallDiv").style.transform = "scale(1)";
      document.getElementById("drawBallDiv").style.opacity = 1;
    },100)
    let theRandomNumber = getBallsRemaining()[cryptoRandom(0,getBallsRemaining().length-1)];
    activateBingoBall(theRandomNumber);
  }
}

function cryptoRandom (min, max) {
    // Create an unsigned 32-bit array, required for crypto.getRandomValues
    // Unsigned 32-bit numbers range from 0 to 4,294,967,295.
    // The 1 means we're going to generate one number.
    const cryptoRandomSet = new Uint32Array(1);
    // Generate a crypto-random number from 0 to 4,294,967,295.
    window.crypto.getRandomValues(cryptoRandomSet);
    // Convert the generated number to math.random() format.
    // aka a number from 0-1 (including 0, but not 1)
    // To get this, we divide the generated number by 4,294,967,295, plus 1.
    // We need to add 1 to the denominator so we'll never get 1 as the result.
    let cryptoRandomNumber = cryptoRandomSet[0] / (4294967295 + 1);
    // Return the random integer based on prior math.random() logic
    return Math.floor(cryptoRandomNumber * (max - min + 1)) + min;
}

function updateBallStats() {
  let counts = getBallCounts();
  document.getElementById("ballsDrawnNum").innerHTML = counts.drawn;
  document.getElementById("ballsRemainingNum").innerHTML = counts.remaining;
  const bingosWon = document.getElementById("bingosWonNum");
  if (bingosWon) {
    bingosWon.innerHTML = saveData.bingosWonInRound;
  }
  const bingosWonTop = document.getElementById("bingosWonNumTop");
  if (bingosWonTop) {
    bingosWonTop.innerHTML = saveData.bingosWonInRound;
  }
}

function adjustBingosWon(delta) {
  const nextValue = Math.max(0, (saveData.bingosWonInRound || 0) + delta);
  saveData.bingosWonInRound = nextValue;
  save();
  updateBallStats();
  speak(nextValue + (nextValue === 1 ? " bingo won" : " bingos won"));
}

function incrementBingosWon() {
  adjustBingosWon(1);
}

function decrementBingosWon() {
  adjustBingosWon(-1);
}

function hideBingo(bingoLetter, renderOrToggle) {
  let bingoLetterClass;
  let bingoBallsClass;
  if (bingoLetter === "B") {
    bingoLetterClass = "bingoB";
    bingoBallsClass = "bingoBallsB";
  }
  else if (bingoLetter === "I") {
    bingoLetterClass = "bingoI";
    bingoBallsClass = "bingoBallsI";
  }
  else if (bingoLetter === "N") {
    bingoLetterClass = "bingoN";
    bingoBallsClass = "bingoBallsN";
  }
  else if (bingoLetter === "G") {
    bingoLetterClass = "bingoG";
    bingoBallsClass = "bingoBallsG";
  }
  else if (bingoLetter === "O") {
    bingoLetterClass = "bingoO";
    bingoBallsClass = "bingoBallsO";
  }

  if (renderOrToggle === "toggle") {
    if (saveData.hiddenBingoLetters.indexOf(bingoLetter) === -1) {
      document.getElementById(bingoLetterClass).classList.add("bingoLetterGray");
      document.getElementById(bingoBallsClass).style.display = "none";
      saveData.hiddenBingoLetters.push(bingoLetter);
      save();
      if (!isHidingForPattern) speak("Hiding letter " + bingoLetter);
    } else {
      document.getElementById(bingoLetterClass).classList.remove("bingoLetterGray");
      document.getElementById(bingoBallsClass).style.display = "block";
      saveData.hiddenBingoLetters.splice(saveData.hiddenBingoLetters.indexOf(bingoLetter), 1);
      save();
      if (!isHidingForPattern) speak("Showing letter " + bingoLetter);
    }
    updateBallStats();
  }

  else if (renderOrToggle === "render") {
    if (saveData.hiddenBingoLetters.indexOf(bingoLetter) === -1) {
      document.getElementById(bingoLetterClass).classList.remove("bingoLetterGray");
      document.getElementById(bingoBallsClass).style.display = "block";
    } else {
      document.getElementById(bingoLetterClass).classList.add("bingoLetterGray");
      document.getElementById(bingoBallsClass).style.display = "none";
    }
  }

  else if (renderOrToggle === "reset") {
    saveData.hiddenBingoLetters = [];
    save();
    const letters = ['B', 'I', 'N', 'G', 'O'];
    for (let i = 0; i< letters.length; i+=1) {
      hideBingo(letters[i], "render");
    }
  }

}

function hideBallsDrawnRemaining() {
  document.getElementById("ballsDrawn").style.display = "none";
  document.getElementById("ballsRemaining").style.display = "none";
  document.getElementById("bingosWon").style.display = "none";
  document.getElementById("ballsDrawnRemaining").style.visibility = "hidden";
  saveData.ballsDrawnRemaining = "hidden";
  save();
}

function toggleBallsDrawnRemaining(renderOrToggle) {
  // Backward compatibility for older saved states.
  if (saveData.ballsDrawnRemaining === "bingos") {
    saveData.ballsDrawnRemaining = "hidden";
    save();
  }
  if (renderOrToggle === "toggle") {
    let counts = getBallCounts();
    if (saveData.ballsDrawnRemaining === "hidden") {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("ballsDrawn").style.display = "flex";
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("bingosWon").style.display = "none";
      saveData.ballsDrawnRemaining = "drawn";
      save();
      speak(counts.drawn + " drawn");
    } else if (saveData.ballsDrawnRemaining === "drawn") {
      document.getElementById("ballsDrawn").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "flex";
      document.getElementById("bingosWon").style.display = "none";
      saveData.ballsDrawnRemaining = "remaining";
      save();
      speak(counts.remaining + " remaining");
    } else {
      document.getElementById("bingosWon").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "none";
      document.getElementById("ballsDrawnRemaining").style.visibility = "hidden";
      saveData.ballsDrawnRemaining = "hidden";
      save();
    }
  }
  else if (renderOrToggle === "render") {
    if (saveData.ballsDrawnRemaining === "hidden") {
    } else if (saveData.ballsDrawnRemaining === "drawn") {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("ballsDrawn").style.display = "flex";
    } else if (saveData.ballsDrawnRemaining === "remaining") {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("ballsRemaining").style.display = "flex";
    } else {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("bingosWon").style.display = "flex";
    }
  }
}

function resetBoard() {
  clearSpeechQueue();
  window.speechSynthesis.cancel();
  for (let i=0;i<75;i+=1) {
    document.getElementById(i+1 + "bingo").classList.remove(document.getElementById(i+1 + "bingo").classList.item(2));
  }
  document.getElementById("bigBingoBall").classList.remove(document.getElementById("bigBingoBall").classList.item(1));
  document.getElementById("bigBingoLetter").innerHTML="&nbsp;";
  document.getElementById("bigBingoNumber").innerHTML="&nbsp;";
  const bingoBallsClass = document.querySelectorAll(".bingoBalls");
  for (let i = 0; i < bingoBallsClass.length; i+=1) {
    bingoBallsClass[i].classList.add("notransition");
    bingoBallsClass[i].style.opacity = 0;
    setTimeout(function() {
      bingoBallsClass[i].classList.remove("notransition");
      bingoBallsClass[i].style.opacity = 1;
    },100)
  }
  document.getElementById("blocker").classList.add("notransition");
  document.getElementById("blocker").style.opacity = 0;

  // Chrome has a Bingo letter rendering bug when resetting with the blocker enabled.
  // Until Chrome fixes this bug, this browser-specific workaround is necessary.
  // Safari also has this bug, but it is fixed in the latest Technology Preview.
  const isChrome = !!window.chrome && !!window.chrome.webstore;
  if (isChrome === true) {
    const bingoLetterClass = document.querySelectorAll(".bingoLetter");
    for (let i = 0; i < bingoLetterClass.length; i+=1) {
      bingoLetterClass[i].classList.add("chromeBingoLetterFix");
      setTimeout(function() {
        bingoLetterClass[i].classList.remove("chromeBingoLetterFix");
      },410)
    }
  }

  setTimeout(function() {
    document.getElementById("blocker").classList.remove("notransition");
    document.getElementById("blocker").style.opacity = 1;
  },100)
  saveData.drawnBingoBalls = [];
  saveData.lastActionWasRemove = false;
  saveData.completedLetters = [];
  saveData.bingosWonInRound = 0;
  save();
  hideBingo("", "reset");
  clearWinningPattern();
  speak("Resetting board!");
  updateBallStats();
}

function toggleBlocker() {
	if (saveData.blockerEnabled === true) {
    saveData.blockerEnabled = false;
		document.getElementById("blocker").style.left = 1287 + "px";
    speak("Showing board");
	} else {
    saveData.blockerEnabled = true;
		document.getElementById("blocker").style.left = 255 + "px";
    speak("Hiding board");
	}
  save();
  updateBoardToggleIcon();
}

function setUpMasterBoard() {
  if (saveData.blockerEnabled === false) {
    document.getElementById("blocker").style.left = 1287 + "px";
  } else {
    document.getElementById("blocker").style.left = 255 + "px";
  }
  updateBoardToggleIcon();
  renderBingoStyle();
  for (let i=0;i<saveData.drawnBingoBalls.length;i+=1) {
    loadBingoBall(saveData.drawnBingoBalls[i]);
  }
  for (let i=0;i<saveData.hiddenBingoLetters.length;i+=1) {
    hideBingo(saveData.hiddenBingoLetters[i], "render");
  }
  for (let i=0;i<saveData.winningPattern.length;i+=1) {
    document.getElementById(saveData.winningPattern[i] + "card").classList.add("bingoCardActive2");
    document.getElementById(saveData.winningPattern[i] + "bigcard").classList.add("bingoCardActive");
  }
  toggleBallsDrawnRemaining("render");
  updateBallStats();
}

function setUpSettings() {
  document.getElementById("classic").style.backgroundColor = "";
  document.getElementById("red").style.backgroundColor = "";
  document.getElementById("green").style.backgroundColor = "";
  document.getElementById("blue").style.backgroundColor = "";
  document.getElementById("purple").style.backgroundColor = "";
  document.getElementById("orange").style.backgroundColor = "";
  document.getElementById("yellow").style.backgroundColor = "";
  document.getElementById("pink").style.backgroundColor = "";
  document.getElementById("teal").style.backgroundColor = "";
  document.getElementById("greyscale").style.backgroundColor = "";
  document.getElementById("bingoStyleBall").style.backgroundColor = "";
  document.getElementById("bingoStyleVintage").style.backgroundColor = "";
  document.getElementById("voiceSelect").value = saveData.voice || 'off';
  if (saveData.themeColor === "classic") {
    document.getElementById("classic").style.backgroundColor = "rgba(148,138,84,0.28)";
  } else if (saveData.themeColor === "red") {
    document.getElementById("red").style.backgroundColor = "rgba(198,40,40,0.2)";
  } else if (saveData.themeColor === "green") {
    document.getElementById("green").style.backgroundColor = "rgba(0,128,0,0.2)";
  } else if (saveData.themeColor === "blue") {
    document.getElementById("blue").style.backgroundColor = "rgba(51,102,255,0.2)";
  } else if (saveData.themeColor === "purple") {
    document.getElementById("purple").style.backgroundColor = "rgba(164,70,153,0.2)";
  } else if (saveData.themeColor === "orange") {
    document.getElementById("orange").style.backgroundColor = "rgba(255,140,0,0.2)";
  } else if (saveData.themeColor === "yellow") {
    document.getElementById("yellow").style.backgroundColor = "rgba(218,165,32,0.2)";
  } else if (saveData.themeColor === "pink") {
    document.getElementById("pink").style.backgroundColor = "rgba(255,105,180,0.2)";
  } else if (saveData.themeColor === "teal") {
    document.getElementById("teal").style.backgroundColor = "rgba(0,128,128,0.2)";
  } else if (saveData.themeColor === "greyscale") {
    document.getElementById("greyscale").style.backgroundColor = "rgba(110,110,110,0.2)";
  }
  if (saveData.bingoStyle === "ball") {
    document.getElementById("bingoStyleBall").style.backgroundColor = "rgba(0,0,0,0.15)";
  } else if (saveData.bingoStyle === "vintage") {
    document.getElementById("bingoStyleVintage").style.backgroundColor = "rgba(0,0,0,0.15)";
  }
  // Detect current pattern name
  saveData.currentPatternName = "No Pattern";
  let sortedWinning = [...saveData.winningPattern].sort((a, b) => a - b);
  for (let name in namedPatterns) {
    let sortedPattern = [...namedPatterns[name]].sort((a, b) => a - b);
    if (JSON.stringify(sortedWinning) === JSON.stringify(sortedPattern)) {
      saveData.currentPatternName = name;
      break;
    }
  }
  updateSelectedPattern();
  initializeScriptGrid();
}

function changeBackgroundColor(theColor) {
  saveData.themeColor = theColor;
  save();
  // Live preview selected theme while still on the Themes page.
  changeBG(theColor);
  setUpSettings();
}

function changeVoice(theVoice) {
  saveData.voice = theVoice;
  if (theVoice !== 'off') {
    saveData.lastVoice = theVoice;
    speechEngineWarmedUp = false;
    speechWarmupInFlight = false;
  } else {
    clearSpeechQueue();
    speechWarmupInFlight = false;
    window.speechSynthesis.cancel();
  }
  save();
  setUpSettings();
  updateVoiceIcon();
}

function changeSpeechParam(param, value) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return;
  if (param === 'rate') {
    saveData.speechRate = numValue;
  } else if (param === 'pitch') {
    saveData.speechPitch = numValue;
  } else if (param === 'volume') {
    saveData.speechVolume = numValue;
  }
  save();
}

function testVoice() {
  speak('B 15');
}

function randomPattern() {
  clearWinningPattern();
  let names = Object.keys(namedPatterns);
  let randomName = names[Math.floor(Math.random() * names.length)];
  saveData.winningPattern = namedPatterns[randomName].slice();
  for (let tile of saveData.winningPattern) {
    toggleTileClasses(tile, true);
  }
  saveData.currentPatternName = randomName;
  save();
  updateSelectedPattern();
  speak(randomName);
}

function updateCurrentPatternName() {
  let sortedWinning = [...saveData.winningPattern].sort((a, b) => a - b);
  let found = false;
  let newName = "";
  for (let name in namedPatterns) {
    let sortedPattern = [...namedPatterns[name]].sort((a, b) => a - b);
    if (JSON.stringify(sortedWinning) === JSON.stringify(sortedPattern)) {
      newName = name;
      found = true;
      break;
    }
  }
  if (!found) {
    newName = saveData.winningPattern.length === 0 ? "No Pattern" : "";
  }
  if (newName !== saveData.currentPatternName) {
    if (newName && newName !== "No Pattern" && !isSetting) {
      speak(newName);
    } else if (newName === "No Pattern" && saveData.currentPatternName !== "") {
      speak("No Pattern");
    } else if (newName === "" && saveData.currentPatternName !== "" && !isSetting) {
      speak("Custom design");
    }
  }
  saveData.currentPatternName = newName;
  save();
  updateSelectedPattern();
}

function toggleTileClasses(tileNumber, add) {
  const bigcard = document.getElementById(tileNumber + "bigcard");
  const card = document.getElementById(tileNumber + "card");
  if (add) {
    bigcard.classList.add("bingoCardActive");
    card.classList.add("bingoCardActive2");
  } else {
    bigcard.classList.remove("bingoCardActive");
    card.classList.remove("bingoCardActive2");
  }
}

function toggleWinningPattern(theNumber) {
  if (saveData.winningPattern.indexOf(theNumber) === -1) {
    toggleTileClasses(theNumber, true);
    saveData.winningPattern.push(theNumber);
  } else {
    toggleTileClasses(theNumber, false);
    saveData.winningPattern.splice(saveData.winningPattern.indexOf(theNumber), 1);
  }
  save();
  updateCurrentPatternName();
}

let isSetting = false;

let isHidingForPattern = false;

function winningPatternFromName() {
  let name = arguments.length > 0 ? arguments[0] : "No Pattern";
  let targetPattern = [];
  for (let i = 1; i < arguments.length; i += 1) {
    targetPattern.push(arguments[i]);
  }
  // Check if the current pattern is the same as the target
  const targetPatternSet = new Set(targetPattern);
  if (saveData.winningPattern.length === targetPattern.length &&
      saveData.winningPattern.every(num => targetPatternSet.has(num))) {
    clearWinningPattern();
    saveData.currentPatternName = "No Pattern";
    save();
    updateSelectedPattern();
    speak("No Pattern");
  } else {
    clearWinningPattern();
    isSetting = true;
    for (let i = 0; i < targetPattern.length; i += 1) {
      toggleWinningPattern(targetPattern[i]);
    }
    isSetting = false;
    saveData.currentPatternName = name;
    save();
    updateSelectedPattern();
    speak(name);
  }
}

function clearWinningPattern() {
  for (let i=0;i<saveData.winningPattern.length;i+=1) {
    toggleTileClasses(saveData.winningPattern[i], false);
  }
  saveData.winningPattern = [];
  saveData.currentPatternName = "No Pattern";
  save();
}

function updateSelectedPattern() {
  document.querySelectorAll('.winningName').forEach(el => el.classList.remove('selected'));
  if (saveData.currentPatternName) {
    let patternId = 'pattern-' + saveData.currentPatternName.replace(/\s+/g, '-');
    let el = document.getElementById(patternId);
    if (el) el.classList.add('selected');
  }
}

function hideBingoLettersBasedOnWinningPattern() {
  let bExists = false;
  let iExists = false;
  let nExists = false;
  let gExists = false;
  let oExists = false;
  if (saveData.winningPattern.length > 0) {
    for (let i=0;i<saveData.winningPattern.length;i+=1) {
      if (saveData.winningPattern[i] <=5) {
        bExists = true;
      } else if (saveData.winningPattern[i] <=10) {
        iExists = true;
      } else if (saveData.winningPattern[i] <=15) {
        nExists = true;
      } else if (saveData.winningPattern[i] <=20) {
        gExists = true;
      } else if (saveData.winningPattern[i] <=25) {
        oExists = true;
      }
    }
    isHidingForPattern = true;
    if (bExists === false && saveData.hiddenBingoLetters.indexOf('B') === -1) {
      hideBingo('B', 'toggle');
    }
    if (iExists === false && saveData.hiddenBingoLetters.indexOf('I') === -1) {
      hideBingo('I', 'toggle');
    }
    if (nExists === false && saveData.hiddenBingoLetters.indexOf('N') === -1) {
      hideBingo('N', 'toggle');
    }
    if (gExists === false && saveData.hiddenBingoLetters.indexOf('G') === -1) {
      hideBingo('G', 'toggle');
    }
    if (oExists === false && saveData.hiddenBingoLetters.indexOf('O') === -1) {
      hideBingo('O', 'toggle');
    }
    isHidingForPattern = false;
  }
}

function navHelp(sectionName) {
  document.getElementById("howToUseBasics").style.display="none";
  document.getElementById("howToUseBasicsHeader").classList.remove("boldHelp");
  document.getElementById("howToUseBasics2").style.display="none";
  document.getElementById("howToUseBasics2Header").classList.remove("boldHelp");
  document.getElementById("howToUseTipsTricks").style.display="none";
  document.getElementById("howToUseTipsTricksHeader").classList.remove("boldHelp");
  document.getElementById("howToUseThanks").style.display="none";
  document.getElementById("howToUseThanksHeader").classList.remove("boldHelp");

  if (sectionName === "Basics") {
    document.getElementById("howToUseBasics").style.display="flex";
    document.getElementById("howToUseBasicsHeader").classList.add("boldHelp");
    document.getElementById("helpNavLine").style.marginLeft = 0 + "px";
  } else if (sectionName === "Basics 2") {
    document.getElementById("howToUseBasics2").style.display="flex";
    document.getElementById("howToUseBasics2Header").classList.add("boldHelp");
    document.getElementById("helpNavLine").style.marginLeft = 180 + "px";
  } else if (sectionName === "Tips & Tricks") {
    document.getElementById("howToUseTipsTricks").style.display="flex";
    document.getElementById("howToUseTipsTricksHeader").classList.add("boldHelp");
    document.getElementById("helpNavLine").style.marginLeft = 360 + "px";
  } else if (sectionName === "Thank You") {
    document.getElementById("howToUseThanks").style.display="flex";
    document.getElementById("howToUseThanksHeader").classList.add("boldHelp");
    document.getElementById("helpNavLine").style.marginLeft = 540 + "px";
  }
}

function keyboardNavHowToUse(leftOrRight) {
  let currentSpot;
  if (document.getElementById("howToUseBasics").style.display === "flex") {
    currentSpot = "Basics";
  } else if (document.getElementById("howToUseBasics2").style.display === "flex") {
    currentSpot = "Basics 2";
  } else if (document.getElementById("howToUseTipsTricks").style.display === "flex") {
    currentSpot = "Tips & Tricks";
  } else {
    currentSpot = "Thank You";
  }
  if (currentSpot === "Basics") {
    if (leftOrRight === 1) {
      navHelp("Basics 2");
    }
  } else if (currentSpot === "Basics 2") {
    if (leftOrRight === 0) {
      navHelp("Basics");
    } else {
      navHelp("Tips & Tricks");
    }
  } else if (currentSpot === "Tips & Tricks") {
    if (leftOrRight === 0) {
      navHelp("Basics 2");
    } else {
      navHelp("Thank You");
    }
  } else if (currentSpot === "Thank You") {
    if (leftOrRight === 0) {
      navHelp("Tips & Tricks");
    }
  }
}

function creditsHelp(sectionName) {
  document.getElementById("creditsAbout").style.display="none";
  document.getElementById("creditsAboutHeader").classList.remove("boldHelp");
  document.getElementById("creditsCredits").style.display="none";
  document.getElementById("creditsCreditsHeader").classList.remove("boldHelp");

  if (sectionName === "About") {
    document.getElementById("creditsAbout").style.display="flex";
    document.getElementById("creditsAboutHeader").classList.add("boldHelp");
    document.getElementById("creditsNavLine").style.marginLeft = 0 + "px";
  } else if (sectionName === "Credits") {
    document.getElementById("creditsCredits").style.display="flex";
    document.getElementById("creditsCreditsHeader").classList.add("boldHelp");
    document.getElementById("creditsNavLine").style.marginLeft = 180 + "px";
  }
}

function keyboardNavCredits(leftOrRight) {
  let currentSpot;
  if (document.getElementById("creditsAbout").style.display === "flex") {
    currentSpot = "About";
  } else {
    currentSpot = "Credits";
  }
  if (currentSpot === "About") {
    if (leftOrRight === 1) {
      creditsHelp("Credits");
    }
  } else if (currentSpot === "Credits") {
    if (leftOrRight === 0) {
      creditsHelp("About");
    }
  }
}

function initializeScriptGrid() {
  const scriptGrid = document.getElementById('scriptGrid');
  scriptGrid.innerHTML = '';
  
  const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
  
  for (let i = 1; i <= 75; i++) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'script-item';
    
    const label = document.createElement('div');
    label.className = 'script-label';
    const letterIndex = Math.floor((i - 1) / 15);
    const ballLabel = bingoLetters[letterIndex] + i;
    label.textContent = ballLabel;
    label.setAttribute('aria-label', 'Click to hear the announcement for ball ' + ballLabel);
    label.onclick = function() {
      const randomScript = getRandomScriptForBall(i);
      speak(randomScript);
    };
    
    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'script-value';
    const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
    const currentScriptValue = currentPreset[i];
    
    let displayText = '0';
    let sayingCount = 0;
    
    if (currentScriptValue) {
      if (Array.isArray(currentScriptValue)) {
        sayingCount = currentScriptValue.length;
        displayText = sayingCount.toString();
      } else {
        sayingCount = 1;
        displayText = '1';
      }
    }
    
    valueDisplay.textContent = displayText;
    valueDisplay.setAttribute(
      'aria-label',
      'Edit script for ball ' + ballLabel + '. Currently has ' + sayingCount + ' saying' + (sayingCount !== 1 ? 's' : '') + ' configured'
    );
    valueDisplay.onclick = function() {
      openScriptEditor(i, ballLabel);
    };
    valueDisplay.style.cursor = 'pointer';
    
    itemDiv.appendChild(label);
    itemDiv.appendChild(valueDisplay);
    scriptGrid.appendChild(itemDiv);
  }
}

function resetScript() {
  if (saveData.currentScriptPreset === 'Default' || saveData.currentScriptPreset === 'Fun Sayings' || saveData.currentScriptPreset === 'Math Jokes' || saveData.currentScriptPreset === 'Dad Jokes' || saveData.currentScriptPreset === 'Puns' || saveData.currentScriptPreset === 'Geeky' || saveData.currentScriptPreset === 'Movie Quotes' || saveData.currentScriptPreset === 'Book Quotes') {
    const presetName = prompt('You cannot modify the Default, Fun Sayings, Math Jokes, Dad Jokes, Puns, Geeky, Movie Quotes, or Book Quotes presets. Enter a name for a new preset to save your reset changes:');
    if (presetName && presetName.trim()) {
      const trimmedName = presetName.trim();
      if (saveData.scriptPresets[trimmedName]) {
        if (!confirm(`Preset "${trimmedName}" already exists. Overwrite it?`)) {
          return;
        }
      }
      saveData.scriptPresets[trimmedName] = {};
      saveData.currentScriptPreset = trimmedName;
      save();
      updateScriptPresetDropdown();
      initializeScriptGrid();
    }
    return;
  }
  
  if (confirm('Are you sure you want to reset all scripts to default ball labels?')) {
    if (!saveData.scriptPresets[saveData.currentScriptPreset]) {
      saveData.scriptPresets[saveData.currentScriptPreset] = {};
    }
    saveData.scriptPresets[saveData.currentScriptPreset] = {};
    save();
    initializeScriptGrid();
  }
}

function getDefaultBallLabel(ballNumber) {
  const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
  const letterIndex = Math.floor((ballNumber - 1) / 15);
  return bingoLetters[letterIndex] + ballNumber;
}

function testScript() {
  // Get all ball numbers that have valid sayings
  const validBallNumbers = [];
  const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
  
  for (let i = 1; i <= 75; i++) {
    const scriptValue = currentPreset[i];
    if (scriptValue) {
      let hasValidSaying = false;
      if (Array.isArray(scriptValue)) {
        // Check if array has at least one non-empty string
        hasValidSaying = scriptValue.some(saying => saying && saying.trim() !== '');
      } else if (scriptValue && scriptValue.trim() !== '') {
        hasValidSaying = true;
      }
      if (hasValidSaying) {
        validBallNumbers.push(i);
      }
    }
  }
  
  if (validBallNumbers.length === 0) {
    // No valid sayings, just pick a random ball and use default label
    const testNumber = Math.floor(Math.random() * 75) + 1;
    const ballLabel = getDefaultBallLabel(testNumber);
    speak(ballLabel);
    return;
  }
  
  // Pick a random ball number that has valid sayings
  const randomIndex = Math.floor(Math.random() * validBallNumbers.length);
  const testNumber = validBallNumbers[randomIndex];
  const scriptText = getScriptForBall(testNumber);
  speak(scriptText);
}

function getScriptForBall(ballNumber) {
  return getRandomScriptForBall(ballNumber);
}

let currentEditingBall = null;

function openScriptEditor(ballNumber, ballLabel) {
  currentEditingBall = ballNumber;
  document.getElementById('scriptEditorTitle').textContent = ballLabel;
  
  const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
  const currentValue = currentPreset[ballNumber];
  
  // Clear existing inputs
  const container = document.getElementById('scriptInputsContainer');
  container.innerHTML = '';
  
  // If it's an array, show all values; if string, show as single input; if none, show one empty input
  let sayings = [];
  if (Array.isArray(currentValue)) {
    sayings = currentValue;
  } else if (currentValue) {
    sayings = [currentValue];
  } else {
    sayings = [ballLabel];
  }
  
  // Set container height based on number of sayings
  const totalInputs = sayings.length + 1; // +1 for the empty input
  if (totalInputs > 5) {
    container.style.maxHeight = '200px'; // Show about 5 inputs worth of space
    container.style.overflowY = 'auto';
  } else {
    container.style.maxHeight = 'none';
    container.style.overflowY = 'visible';
  }
  
  // Create input fields for each saying
  sayings.forEach((saying, index) => {
    addScriptInput(saying, index);
  });
  
  // Add one empty input for adding new sayings
  addScriptInput('', sayings.length);
  
  document.getElementById('scriptEditorOverlay').style.display = 'flex';
}

function addScriptInput(value, index) {
  const container = document.getElementById('scriptInputsContainer');
  const inputGroup = document.createElement('div');
  inputGroup.className = 'script-input-group';
  inputGroup.style.marginBottom = '10px';
  inputGroup.style.display = 'flex';
  inputGroup.style.alignItems = 'center';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.placeholder = 'Enter saying...';
  input.style.width = '70%';
  input.style.padding = '8px';
  input.style.marginRight = '10px';
  
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.title = 'Test this saying';
  testBtn.style.width = '32px';
  testBtn.style.height = '32px';
  testBtn.style.border = '1px solid #ccc';
  testBtn.style.borderRadius = '4px';
  testBtn.style.backgroundColor = '#f9f9f9';
  testBtn.style.backgroundImage = 'url("./assets/img/voiceOn.svg")';
  testBtn.style.backgroundSize = '20px';
  testBtn.style.backgroundRepeat = 'no-repeat';
  testBtn.style.backgroundPosition = 'center';
  testBtn.style.cursor = 'pointer';
  testBtn.style.marginRight = '10px';
  testBtn.onmouseover = function() {
    testBtn.style.backgroundImage = 'url("./assets/img/voiceOnHover.svg")';
  };
  testBtn.onmouseout = function() {
    testBtn.style.backgroundImage = 'url("./assets/img/voiceOn.svg")';
  };
  testBtn.onclick = function() {
    testSpecificSaying(input.value.trim());
  };
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = function() {
    container.removeChild(inputGroup);
    updateScriptContainerHeight();
  };
  removeBtn.style.padding = '8px 12px';
  
  inputGroup.appendChild(testBtn);
  inputGroup.appendChild(input);
  inputGroup.appendChild(removeBtn);
  container.appendChild(inputGroup);
  
  updateScriptContainerHeight();
}

function updateScriptContainerHeight() {
  const container = document.getElementById('scriptInputsContainer');
  const inputGroups = container.querySelectorAll('.script-input-group');
  
  if (inputGroups.length > 5) {
    container.style.maxHeight = '200px'; // Show about 5 inputs worth of space
    container.style.overflowY = 'auto';
  } else {
    container.style.maxHeight = 'none';
    container.style.overflowY = 'visible';
  }
}

function closeScriptEditor() {
  document.getElementById('scriptEditorOverlay').style.display = 'none';
  currentEditingBall = null;
}

function resetScriptEditor() {
  if (currentEditingBall) {
    const ballLabel = getDefaultBallLabel(currentEditingBall);
    // Clear existing inputs and add one with the default label
    const container = document.getElementById('scriptInputsContainer');
    container.innerHTML = '';
    addScriptInput(ballLabel, 0);
    addScriptInput('', 1); // Add empty input for adding more
    updateScriptContainerHeight();
  }
}

function saveScriptEditor() {
  if (currentEditingBall) {
    // Collect all non-empty inputs
    const container = document.getElementById('scriptInputsContainer');
    const inputs = container.querySelectorAll('input[type="text"]');
    const sayings = [];
    
    inputs.forEach(input => {
      const value = input.value.trim();
      if (value) {
        sayings.push(value);
      }
    });
    
    // Validate that each saying has at least 3 characters
    const invalidSayings = sayings.filter(saying => saying.length < 3);
    if (invalidSayings.length > 0) {
      alert('Each saying must be at least 3 characters long. Please fix the following sayings:\n\n' + invalidSayings.map(s => '• "' + s + '"').join('\n'));
      return;
    }
    
    // If current preset is Default, Fun Sayings, or Math Jokes, force Save As instead of overwriting
    if (saveData.currentScriptPreset === 'Default' || saveData.currentScriptPreset === 'Fun Sayings' || saveData.currentScriptPreset === 'Math Jokes' || saveData.currentScriptPreset === 'Dad Jokes' || saveData.currentScriptPreset === 'Puns' || saveData.currentScriptPreset === 'Geeky' || saveData.currentScriptPreset === 'Movie Quotes' || saveData.currentScriptPreset === 'Book Quotes') {
      if (sayings.length > 0) {
        const presetName = prompt('You cannot modify the Default, Fun Sayings, Math Jokes, Dad Jokes, Puns, Geeky, Movie Quotes, or Book Quotes presets. Enter a name for a new preset to save your changes:');
        if (presetName && presetName.trim()) {
          const trimmedName = presetName.trim();
          if (saveData.scriptPresets[trimmedName]) {
            if (!confirm(`Preset "${trimmedName}" already exists. Overwrite it?`)) {
              return;
            }
          }
          // Create new preset with current Default scripts plus the modification
          saveData.scriptPresets[trimmedName] = { ...saveData.scriptPresets['Default'] };
          if (sayings.length === 1) {
            saveData.scriptPresets[trimmedName][currentEditingBall] = sayings[0];
          } else {
            saveData.scriptPresets[trimmedName][currentEditingBall] = sayings;
          }
          saveData.currentScriptPreset = trimmedName;
          save();
          updateScriptPresetDropdown();
          initializeScriptGrid();
          closeScriptEditor();
        }
      }
      return;
    }
    
    // Normal save for non-Default presets
    if (!saveData.scriptPresets[saveData.currentScriptPreset]) {
      saveData.scriptPresets[saveData.currentScriptPreset] = {};
    }
    
    if (sayings.length === 0) {
      delete saveData.scriptPresets[saveData.currentScriptPreset][currentEditingBall];
    } else if (sayings.length === 1) {
      saveData.scriptPresets[saveData.currentScriptPreset][currentEditingBall] = sayings[0];
    } else {
      saveData.scriptPresets[saveData.currentScriptPreset][currentEditingBall] = sayings;
    }
    
    save();
    initializeScriptGrid();
    closeScriptEditor();
  }
}

function resetScriptEditor() {
  if (currentEditingBall) {
    const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
    const letterIndex = Math.floor((currentEditingBall - 1) / 15);
    const ballLabel = bingoLetters[letterIndex] + currentEditingBall;
    document.getElementById('scriptEditorInput').value = ballLabel;
  }
}

function testScriptEditor() {
  const container = document.getElementById('scriptInputsContainer');
  const inputs = container.querySelectorAll('input[type="text"]');
  const sayings = [];
  
  inputs.forEach(input => {
    const value = input.value.trim();
    if (value) {
      sayings.push(value);
    }
  });
  
  if (sayings.length > 0) {
    const randomSaying = sayings[Math.floor(Math.random() * sayings.length)];
    const ballLabel = getDefaultBallLabel(currentEditingBall);
    const formattedScript = ballLabel + '. ' + randomSaying + ' ' + ballLabel + '.';
    speak(formattedScript);
  }
}

function testSpecificSaying(saying) {
  if (saying && currentEditingBall) {
    const ballLabel = getDefaultBallLabel(currentEditingBall);
    const formattedScript = ballLabel + '. ' + saying + ' ' + ballLabel + '.';
    speak(formattedScript);
  }
}

// Script preset management functions
function convertLetterKeysToNumbers(scripts) {
  const converted = {};
  const bingoLetters = ['B', 'I', 'N', 'G', 'O'];
  
  Object.keys(scripts).forEach(key => {
    // If it's already a number, keep it as is
    if (!isNaN(key)) {
      converted[key] = scripts[key];
      return;
    }
    
    // If it's a letter-number format, convert to number
    const letter = key.charAt(0).toUpperCase();
    const number = parseInt(key.substring(1));
    
    if (bingoLetters.includes(letter) && !isNaN(number) && number >= 1 && number <= 75) {
      const letterIndex = bingoLetters.indexOf(letter);
      const expectedMin = letterIndex * 15 + 1;
      const expectedMax = (letterIndex + 1) * 15;
      
      if (number >= expectedMin && number <= expectedMax) {
        converted[number] = scripts[key];
      }
    }
  });
  
  return converted;
}

function getRandomScriptForBall(ballNumber) {
  const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
  const scriptValue = currentPreset[ballNumber];
  const ballLabel = getDefaultBallLabel(ballNumber);
  
  if (!scriptValue) {
    return ballLabel;
  }
  
  let saying;
  // If it's an array, pick a random one that is not empty
  if (Array.isArray(scriptValue)) {
    // Filter out empty or undefined sayings
    const validSayings = scriptValue.filter(saying => saying && saying.trim() !== '');
    if (validSayings.length === 0) {
      return ballLabel;
    }
    saying = validSayings[Math.floor(Math.random() * validSayings.length)];
  } else {
    saying = scriptValue;
  }
  
  // Format: "B1. [saying] B1."
  return ballLabel + '. ' + saying + ' ' + ballLabel + '.';
}

function saveCurrentScriptsAsPreset() {
  const presetName = prompt('Enter a name for this script preset:');
  if (presetName && presetName.trim()) {
    const trimmedName = presetName.trim();
    if (saveData.scriptPresets[trimmedName]) {
      if (!confirm(`Preset "${trimmedName}" already exists. Overwrite it?`)) {
        return;
      }
    }
    // Deep copy the current preset
    saveData.scriptPresets[trimmedName] = JSON.parse(JSON.stringify(saveData.scriptPresets[saveData.currentScriptPreset] || {}));
    saveData.currentScriptPreset = trimmedName;
    save();
    updateScriptPresetDropdown();
    initializeScriptGrid();
  }
}

function switchScriptPreset() {
  const dropdown = document.getElementById('scriptPresetDropdown');
  const selectedPreset = dropdown.value;
  if (selectedPreset) {
    // Handle default presets that might not be in saveData.scriptPresets
    if ((selectedPreset === 'Default' || selectedPreset === 'Fun Sayings' || selectedPreset === 'Math Jokes' || selectedPreset === 'Dad Jokes' || selectedPreset === 'Puns' || selectedPreset === 'Geeky' || selectedPreset === 'Movie Quotes' || selectedPreset === 'Book Quotes') && !saveData.scriptPresets[selectedPreset]) {
      // Ensure default presets are loaded
      if (selectedPreset === 'Default' && !saveData.scriptPresets['Default']) {
        saveData.scriptPresets['Default'] = {};
      }
      // Fun Sayings and Math Jokes should be loaded by loadDefaultScripts, but if not, load them
      if ((selectedPreset === 'Fun Sayings' || selectedPreset === 'Math Jokes' || selectedPreset === 'Dad Jokes' || selectedPreset === 'Puns' || selectedPreset === 'Geeky' || selectedPreset === 'Movie Quotes' || selectedPreset === 'Book Quotes') && !saveData.scriptPresets[selectedPreset]) {
        loadDefaultScripts();
        return; // loadDefaultScripts will handle the switching
      }
    }
    
    if (saveData.scriptPresets[selectedPreset]) {
      saveData.currentScriptPreset = selectedPreset;
      save();
      updateScriptPresetDropdown(); // Ensure dropdown is in sync
      initializeScriptGrid();
    }
  }
}

function deleteScriptPreset() {
  const dropdown = document.getElementById('scriptPresetDropdown');
  const selectedPreset = dropdown.value;
  
  if (selectedPreset === 'Default' || selectedPreset === 'Fun Sayings' || selectedPreset === 'Math Jokes' || selectedPreset === 'Dad Jokes' || selectedPreset === 'Puns' || selectedPreset === 'Geeky' || selectedPreset === 'Movie Quotes' || selectedPreset === 'Book Quotes') {
    alert('Cannot delete the Default, Fun Sayings, Math Jokes, Dad Jokes, Puns, Geeky, Movie Quotes, or Book Quotes presets.');
    return;
  }
  
  if (confirm(`Are you sure you want to delete the "${selectedPreset}" preset?`)) {
    delete saveData.scriptPresets[selectedPreset];
    if (saveData.currentScriptPreset === selectedPreset) {
      saveData.currentScriptPreset = 'Default';
    }
    save();
    updateScriptPresetDropdown();
    initializeScriptGrid();
  }
}

function updateScriptPresetDropdown() {
  const dropdown = document.getElementById('scriptPresetDropdown');
  if (!dropdown) return;
  
  dropdown.innerHTML = '';
  
  // Always include default presets
  const allPresets = ['Default', 'Fun Sayings', 'Math Jokes', 'Dad Jokes', 'Puns', 'Geeky', 'Movie Quotes', 'Book Quotes', ...Object.keys(saveData.scriptPresets)];
  const uniquePresets = [...new Set(allPresets)]; // Remove duplicates
  
  uniquePresets.forEach(presetName => {
    const option = document.createElement('option');
    option.value = presetName;
    option.textContent = presetName;
    if (presetName === saveData.currentScriptPreset) {
      option.selected = true;
    }
    dropdown.appendChild(option);
  });
  
  // Update button states based on current preset
  const isProtectedPreset = saveData.currentScriptPreset === 'Default' || saveData.currentScriptPreset === 'Fun Sayings' || saveData.currentScriptPreset === 'Math Jokes' || saveData.currentScriptPreset === 'Dad Jokes' || saveData.currentScriptPreset === 'Puns' || saveData.currentScriptPreset === 'Geeky' || saveData.currentScriptPreset === 'Movie Quotes' || saveData.currentScriptPreset === 'Book Quotes';
  const saveAsButton = document.querySelector('button[onclick="saveCurrentScriptsAsPreset()"]');
  const deleteButton = document.querySelector('button[onclick="deleteScriptPreset()"]');
  
  if (saveAsButton) {
    saveAsButton.disabled = false; // Always enabled - used to save changes from protected presets
    saveAsButton.style.opacity = '1';
  }
  
  if (deleteButton) {
    deleteButton.disabled = isProtectedPreset;
    deleteButton.style.opacity = isProtectedPreset ? '0.5' : '1';
  }
}

function exportScriptsToJSON() {
  const currentPreset = saveData.scriptPresets[saveData.currentScriptPreset] || {};
  const exportData = {
    presetName: saveData.currentScriptPreset,
    scripts: currentPreset,
    exportedAt: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = `bingo-scripts-${saveData.currentScriptPreset.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadPreset(filename, presetName, shouldInitializeGrid = false) {
  fetch(`./assets/presets/${filename}`)
    .then(response => {
      if (!response.ok) {
        console.warn(`Could not load ${filename}`);
        return;
      }
      return response.json();
    })
    .then(data => {
      if (data && data.scripts) {
        saveData.scriptPresets[presetName] = convertLetterKeysToNumbers(data.scripts);
        save();
        updateScriptPresetDropdown();
        if (shouldInitializeGrid) {
          initializeScriptGrid();
        }
      }
    })
    .catch(error => {
      console.warn(`Error loading ${presetName}:`, error);
    });
}

function loadDefaultScripts() {
  // Load all default presets
  loadPreset('fun-bingo-sayings.json', 'Fun Sayings', true);
  loadPreset('math-jokes-sayings.json', 'Math Jokes');
  loadPreset('dad-jokes-sayings.json', 'Dad Jokes');
  loadPreset('puns-sayings.json', 'Puns');
  loadPreset('geeky-sayings.json', 'Geeky');
  loadPreset('movie-quotes-sayings.json', 'Movie Quotes');
  loadPreset('book-quotes-sayings.json', 'Book Quotes');
}

function importScriptsFromJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        
        if (!importData.scripts || typeof importData.scripts !== 'object') {
          alert('Invalid script file format.');
          return;
        }
        
        let presetName = importData.presetName || 'Imported';
        
        // Handle name conflicts
        let counter = 1;
        let originalName = presetName;
        while (saveData.scriptPresets[presetName]) {
          presetName = `${originalName} (${counter})`;
          counter++;
        }
        
        saveData.scriptPresets[presetName] = convertLetterKeysToNumbers(importData.scripts);
        saveData.currentScriptPreset = presetName;
        save();
        updateScriptPresetDropdown();
        initializeScriptGrid();
        
        alert(`Scripts imported successfully as "${presetName}" preset.`);
      } catch (error) {
        alert('Error importing scripts: ' + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}
