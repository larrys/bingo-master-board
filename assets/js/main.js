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
  ballsDrawnRemaining: "drawn",
  hiddenBingoLetters: [],
  winningPattern: [],
  firstRun: 0,
  voice: "off",
  completedLetters: [],
  lastVoice: null,
  currentPatternName: "No Pattern",
  speechRate: 1,
  speechPitch: 1,
  speechVolume: 0.8
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
  if (param === "?masterboard") {
    setTimeout(function() {
      hide("titleSlide");
      show("fullScreenToggleLayer");
  		show("masterBoardSlide", "grid");
  	},50);
  } else {
    if (saveData.firstRun === 0 && supportsLocalStorage) {
      saveData.firstRun = 1;
      save();
      setTimeout(function() {
        hide("titleSlide");
        show("onboardingSlide");
      },50);
    } else {
      setTimeout(function() {
        show("titleSlide");
      },50);
    }
  }
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
  }
  updateVoiceIcon();
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

function toggleVoice() {
  if (saveData.voice === 'off') {
    saveData.voice = saveData.lastVoice || 'voice0';
  } else {
    saveData.lastVoice = saveData.voice;
    saveData.voice = 'off';
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
        else if (e.key === 'x') {toggleBlocker();}
        else if (e.key === 'b') {hideBingo('B', 'toggle');}
        else if (e.key === 'i') {hideBingo('I', 'toggle');}
        else if (e.key === 'n') {hideBingo('N', 'toggle');}
        else if (e.key === 'g') {hideBingo('G', 'toggle');}
        else if (e.key === 'o') {hideBingo('O', 'toggle');}
        else if (e.key === 't') {hide('masterBoardSlide');show('settingsSlide', 'grid');}
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
		changeBG();
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
  if (color === "classic") {
    newColor = "#d1cc85";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#c4bd97, #948A54)";
  } else if (color === "red") {
    newColor = "rgb(253, 166, 166)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#ed9f9d, #c0504d)";
  } else if (color === "green") {
    newColor = "rgb(150, 206, 129)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#a9c571, #77933c)";
  } else if (color === "blue") {
    newColor = "rgb(139, 199, 226)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#9abce6, #558ed5)";
  } else if (color === "purple") {
    newColor = "rgb(189, 176, 216)";
    document.getElementById("blocker").style.backgroundImage = "linear-gradient(#b3a2c7, #725892)";
  } else {
    newColor = "radial-gradient(#f7eaab, #bfbb73)";
  }
	document.getElementById("area").style.background=newColor;
	document.getElementById("fader").style.background=newColor;
}

function setBigBingoBall(typeOfBingoBall, typeOfBingoBallLetter, bingoIDNum) {
  document.getElementById("bigBingoBall").classList.remove(document.getElementById("bigBingoBall").classList.item(1));
  if (saveData.bingoStyle === "ball") {
    document.getElementById("bigBingoBall").classList.add(typeOfBingoBall);
  } else {
    document.getElementById("bigBingoBall").classList.add("bigBingoBallVintage");
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
		document.getElementById(bingoID).classList.add(typeOfBingoBall);
    setBigBingoBall(typeOfBingoBall, typeOfBingoBallLetter, bingoIDNum);
    document.getElementById("bigBingoNumber").style.fontSize=104+"px";
    setTimeout(function() {
      document.getElementById("bigBingoNumber").style.fontSize=95+"px";
    },100);
    saveData.drawnBingoBalls.push(bingoIDNum);
    saveData.lastActionWasRemove = false;
    save();
    speak(typeOfBingoBallLetter + " " + bingoIDNum);
    let counts = getBallCounts();
    if (document.getElementById("ballsDrawnRemaining").style.visibility === "visible") {
      if (saveData.ballsDrawnRemaining === "drawn") {
        speak(counts.drawn + " drawn");
      } else {
        speak(counts.remaining + " remaining");
      }
    }
    if (isLetterComplete(typeOfBingoBallLetter) && saveData.completedLetters.indexOf(typeOfBingoBallLetter) === -1) {
      saveData.completedLetters.push(typeOfBingoBallLetter);
      save();
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
      }
    }
	}
  updateBallStats();
}

function speak(text) {
  if ('speechSynthesis' in window && saveData.voice !== 'off') {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language || 'en-US';
    utterance.rate = saveData.speechRate;
    utterance.pitch = saveData.speechPitch;
    utterance.volume = saveData.speechVolume;
    setVoice(utterance);
    window.speechSynthesis.speak(utterance);
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
      if (!isHidingForPattern) speak("Hiding " + bingoLetter);
    } else {
      document.getElementById(bingoLetterClass).classList.remove("bingoLetterGray");
      document.getElementById(bingoBallsClass).style.display = "block";
      saveData.hiddenBingoLetters.splice(saveData.hiddenBingoLetters.indexOf(bingoLetter), 1);
      save();
      if (!isHidingForPattern) speak("Showing " + bingoLetter);
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
  document.getElementById("ballsDrawnRemaining").style.visibility = "hidden";
  saveData.ballsDrawnRemaining = "hidden";
  save();
}

function toggleBallsDrawnRemaining(renderOrToggle) {
  if (renderOrToggle === "toggle") {
    let counts = getBallCounts();
    if (saveData.ballsDrawnRemaining === "hidden") {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("ballsDrawn").style.display = "flex";
      saveData.ballsDrawnRemaining = "drawn";
      save();
      speak(counts.drawn + " drawn");
    } else if (saveData.ballsDrawnRemaining === "drawn") {
      document.getElementById("ballsDrawn").style.display = "none";
      document.getElementById("ballsRemaining").style.display = "flex";
      saveData.ballsDrawnRemaining = "remaining";
      save();
      speak(counts.remaining + " remaining");
    } else {
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
    } else {
      document.getElementById("ballsDrawnRemaining").style.visibility = "visible";
      document.getElementById("ballsRemaining").style.display = "flex";
    }
  }
}

function resetBoard() {
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
  save();
  hideBingo("", "reset");
  clearWinningPattern();
  speak("Clear boards, please");
  updateBallStats();
}

function toggleBlocker() {
	if (saveData.blockerEnabled === true) {
    saveData.blockerEnabled = false;
		document.getElementById("blocker").style.left = 1287 + "px";
    document.getElementById("showBoard").style.display = "none";
    document.getElementById("hideBoard").style.display = "flex";
    speak("Showing board");
	} else {
    saveData.blockerEnabled = true;
		document.getElementById("blocker").style.left = 255 + "px";
    document.getElementById("hideBoard").style.display = "none";
    document.getElementById("showBoard").style.display = "flex";
    speak("Hiding board");
	}
  save();
}

function setUpMasterBoard() {
  if (saveData.blockerEnabled === false) {
    document.getElementById("showBoard").style.display = "none";
    document.getElementById("hideBoard").style.display = "flex";
    document.getElementById("blocker").style.left = 1287 + "px";
  } else {
    document.getElementById("hideBoard").style.display = "none";
    document.getElementById("showBoard").style.display = "flex";
    document.getElementById("blocker").style.left = 255 + "px";
  }
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
  document.getElementById("bingoStyleBall").style.backgroundColor = "";
  document.getElementById("bingoStyleVintage").style.backgroundColor = "";
  document.getElementById("voiceSelect").value = saveData.voice || 'off';
  if (saveData.themeColor === "classic") {
    document.getElementById("classic").style.backgroundColor = "rgba(148,138,84,0.28)";
  } else if (saveData.themeColor === "red") {
    document.getElementById("red").style.backgroundColor = "rgba(255,0,0,0.2)";
  } else if (saveData.themeColor === "green") {
    document.getElementById("green").style.backgroundColor = "rgba(0,128,0,0.2)";
  } else if (saveData.themeColor === "blue") {
    document.getElementById("blue").style.backgroundColor = "rgba(51,102,255,0.2)";
  } else if (saveData.themeColor === "purple") {
    document.getElementById("purple").style.backgroundColor = "rgba(164,70,153,0.2)";
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
}

function changeBackgroundColor(theColor) {
  saveData.themeColor = theColor;
  save();
  setUpSettings();
}

function changeVoice(theVoice) {
  saveData.voice = theVoice;
  if (theVoice !== 'off') {
    saveData.lastVoice = theVoice;
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
    if (bExists === false) {
      hideBingo('B', 'toggle');
    }
    if (iExists === false) {
      hideBingo('I', 'toggle');
    }
    if (nExists === false) {
      hideBingo('N', 'toggle');
    }
    if (gExists === false) {
      hideBingo('G', 'toggle');
    }
    if (oExists === false) {
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
