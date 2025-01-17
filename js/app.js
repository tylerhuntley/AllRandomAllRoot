const PLAYER_LIST_STORAGE_KEY = "playerList";

const State = {
  playerList: [],
  addBot: false,
  game: null
}

function loadState(){
  const playerListStoredString = window.localStorage.getItem(PLAYER_LIST_STORAGE_KEY);
  State.playerList = playerListStoredString ? JSON.parse(playerListStoredString) : [];
  populatePlayerListHtml();
}

function savePlayersLocally() {
  window.localStorage.setItem(PLAYER_LIST_STORAGE_KEY, JSON.stringify(State.playerList));
}

function populatePlayerListHtml() {
  const playerList = document.getElementById("playerList");
  while(playerList.firstChild) {
    playerList.removeChild(playerList.firstChild);
  }
  State.playerList.forEach((player, index) => {
    const newPlayerListItem = document.createElement("li");

    const button = document.createElement("button");
    button.setAttribute("index", index.toString());
    button.setAttribute("class", "button");
    button.innerHTML = "X";
    button.addEventListener("click", clearPlayer);
    newPlayerListItem.appendChild(button);

    newPlayerListItem.appendChild(document.createTextNode(player.name));

    playerList.appendChild(newPlayerListItem);
  });
}

function clearPlayer(event) {
  const index = event.srcElement.getAttribute("index");
  if (index === undefined || index >= State.playerList.length) {
    console.error("clearPlayer() called on element with bad index.")
    return;
  }

  State.playerList.splice(index, 1);
  savePlayersLocally();

  populatePlayerListHtml();
}

function clearPlayers(event) {
  event.preventDefault();

  State.playerList = [];
  savePlayersLocally();

  populatePlayerListHtml();
}

function addPlayer(event) {
  event.preventDefault();

  const playerName = document.getElementById("playerNameInput").value;
  // Don't add players with duplicate, bot, or empty names
  if (!State.addBot) {
    const badNames = State.playerList.map(player => player.name)
      .concat(Object.values(DATA.BOT_PLAYERS).map(player => player.name))
      .concat(["", "Random Bot"]);
    if (badNames.includes(playerName)) {
      throw "Invalid player name.";
    }
  }
  // Don't add too many bot players
  else if (State.addBot) {
     const botPlayers = State.playerList.filter(player => player.bot).length;
     const maxBots = Object.keys(DATA.BOT_PLAYERS).length;
     if (botPlayers >= maxBots) {
       throw "Maximum number of bot players reached.";
     }
   }

  State.playerList.push({
    name: playerName || "Random Bot",
    faction: undefined,
    iconFileName: null,
    bot: State.addBot
  });
  savePlayersLocally();

  populatePlayerListHtml();
  document.getElementById("playerNameInput").value = "";
}

function canFactionBePicked(faction, selectedFactions, forBot) {
  if (forBot && !isBotFaction(faction)) return false;
  const factionObj = getFaction(faction);
  if (factionObj.onlyPresentWith && factionObj.onlyPresentWith.length > 0) {
    const requiredFactions = factionObj.onlyPresentWith.map(presentWith => presentWith || console.error(`Invalid faction in onlyPresentWith for ${factionObj.name}: ${presentWith}`));
    if (requiredFactions.filter(requiredFaction => selectedFactions.indexOf(requiredFaction) === -1).length > 0) {
      return false;
    }
  }
  return true;
}

function getFaction(faction) {
  return DATA.FACTIONS[faction];
}

function isBotFaction(faction) {
  return Object.values(DATA.BOT_PLAYERS).map(bot => bot.faction).includes(faction);
}

function selectRandomFactions(numHumans, numBots, chosenFactions) {
  const availableFactions = Array.from(DATA.FACTION_LIST_BY_REACH);
  const numFactions = numHumans + numBots + chosenFactions.length;
  if(numFactions <= 1) {
    throw "Insufficient player count.";
  }
  else if(numFactions > availableFactions.length) {
    throw "Not enough available factions for this player count.";
  }

  const minReach = DATA.REACH_BY_PLAYER_COUNT[numFactions];
  var currentReach = 0;
  const selectedFactions = [];

  function selectFaction(faction) {
    selectedFactions.push(faction);
    availableFactions.splice(availableFactions.indexOf(faction), 1);
    currentReach += getFaction(faction).reach;
  }

  function pickReachableFaction(forBot) {
    // Calculate the minimum reach a faction can have to still be considered. We do this by summing the X biggest factions, where X is remaining players - 1, then
    //  determining the minimum reach that the last faction could have to still hit the target reach value.
    const biggestCombinationStartIndex = availableFactions.length - (numFactions - 1 - selectedFactions.length);
    const minimumFactionReach = minReach - currentReach - availableFactions.slice(biggestCombinationStartIndex).map(faction => getFaction(faction).reach).reduce((total, reach) => total += reach, 0);
    // Drop any factions from the list that would no longer allow us to hit the target reach
    while (availableFactions.length > 0 && getFaction(availableFactions[0]).reach < minimumFactionReach) {
      availableFactions.splice(0, 1);
    }
    if (availableFactions.length == 0) {
      throw "There is no combination of available factions which hits the target reach.";
    }
    // Pluck random faction
    const pickableFactions = availableFactions.filter(faction => canFactionBePicked(faction, selectedFactions, forBot));
    const pickableFactionIndex = Math.floor(Math.random() * pickableFactions.length);
    const faction = pickableFactions[pickableFactionIndex];
    selectFaction(faction);
  }

  chosenFactions.forEach(faction => selectFaction(faction));
  for(var i = 0; i < numBots; i++) pickReachableFaction(true);
  for(var i = 0; i < numHumans; i++) pickReachableFaction(false);
  return selectedFactions;
}

function randomizeClearings(gameMap) {
  const numOfEachClearingType = Math.ceil(gameMap.numClearings / DATA.CLEARING_TYPES_LIST.length);
  const availableClearings = [];
  for (var i = 0; i < numOfEachClearingType; i++) {
    DATA.CLEARING_TYPES_LIST.forEach(clearingType => availableClearings.push(clearingType));
  }
  return availableClearings
    .map(clearing => ({ sortIndex: Math.random(), value: clearing }))
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(sortableClearing => sortableClearing.value)
    .splice(0, gameMap.numClearings);
}

function randomizeMap() {
  const map = DATA.MAP_LIST[Math.floor(Math.random() * DATA.MAP_LIST.length)];
  return {
    name: map.name,
    alt: map.alt,
    imageFileName: map.imageFileName,
    clearings: randomizeClearings(map)
  }
}

function getBotPlayer(faction) {
  if (!isBotFaction(faction)) throw "Bots cannot play this faction.";
  const bots = Object.values(DATA.BOT_PLAYERS);
  for (let i = 0; i < bots.length; i++) {
    if (faction == bots[i].faction) return bots[i];
  }
}

function assignPlayerFactions() {
  const players = Array.from(State.playerList);
  const numBots = players.filter(player => player.bot).length
  const chosenFactions = players.filter(player => player.faction);
  const factions = selectRandomFactions(players.length - numBots, numBots, chosenFactions);
  const setup = [];
  // Pre-chosen factions go first
  players.forEach(player => {
    if (player.faction) {
      factions.splice(player.faction, 1);
      setup.push(player);
    }
  })
  // Assign bot factions to all bots next
  players.forEach(player => {
    if (player.bot && player.faction === undefined) {
      const botFaction = factions.filter(faction => isBotFaction(faction))[0];
      factions.splice(factions.indexOf(botFaction), 1);
      setup.push(getBotPlayer(botFaction));
    }
  })
  // Assign remaining factions to players last
  players.forEach(player => {
    if (!player.bot && player.faction === undefined) {
      const newPlayer = {...player};
      newPlayer.faction = factions.splice(0,1)[0];
      setup.push(newPlayer);
    }
  })
  return setup;
}

function randomizeGame() {
  const playerSetups = assignPlayerFactions();
  return {
    tableSize: playerSetups.length,
    seats: playerSetups.sort(() => Math.random() - 0.5),
    map: randomizeMap()
  }
}

function toggleBot() {
  const nameInput = document.getElementById("playerNameInput");
  const addBot = document.getElementById("add-bot");
  if (addBot.checked) {
    nameInput.setAttribute("readonly", true);
    nameInput.setAttribute("placeholder", "Random Bot");
    nameInput.setAttribute("value", "");
    State.addBot = true;
  }
  else {
    nameInput.removeAttribute("readonly");
    nameInput.setAttribute("placeholder", "");
    nameInput.setAttribute("value", "");
    State.addBot = false;
  }
}

function getSeatListHtml(seats) {
  const seatList = document.createElement("ul");
  seatList.setAttribute("class", "seat-list");

  seats.forEach(seat => {
    const seatListItem = document.createElement("li");
    const factionObj = getFaction(seat.faction);
    const iconFileName = seat.iconFileName ?? factionObj.iconFileName;
    const iconPath = `./icons/${iconFileName}`;
    const icon = iconPath ? `<img src=${iconPath} class="faction-icon">` : "";
    seatListItem.innerHTML = `<b>${seat.name}</b> will play <b>${factionObj.name}</b> ${icon}`;
    seatList.appendChild(seatListItem);
  });
  return seatList;
}

function getMapImageOverlayHtml(map) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("mapWrapper");

  const backgroundMap = document.createElement("img");
  backgroundMap.classList.add("backgroundMap");
  backgroundMap.setAttribute("src", `./maps/${map.imageFileName}`);
  wrapper.appendChild(backgroundMap);

  // Build the individual clearing elements and capture alt text.
  const clearingAltTexts = [];
  map.clearings.forEach((clearing, index) => {
    const clearingIcon = document.createElement("img");
    clearingIcon.classList.add("clearingIcon");
    clearingIcon.classList.add(`${map.name}-pos${index}`);
    clearingIcon.setAttribute("src", `./icons/${clearing.iconFileName}`);
    const clearingAltText = `Position ${index}: ${clearing.name} clearing.`;
    clearingIcon.setAttribute("alt", clearingAltText);

    clearingAltTexts.push(clearingAltText);
    wrapper.appendChild(clearingIcon)
  })

  // Update the background with the finalized alt text.
  let mapAltText = `${map.alt}\nOverlaid with randomly ordered clearings.`;
  clearingAltTexts.forEach((clearingAlt) => {
    mapAltText += `\n${clearingAlt}`;
  });
  backgroundMap.setAttribute("alt", mapAltText);

  return wrapper;
}

function getMapHtml(map) {
  const mapHtml = document.createElement("div");
  const mapText = document.createElement("span");
  mapText.innerHTML = `The game will be played on the <b>${map.name}</b> map:`;
  mapHtml.appendChild(mapText);

  const overlayElement = getMapImageOverlayHtml(map);
  mapHtml.appendChild(overlayElement);

  return mapHtml;
}

function populateGameHtml() {
  const gameContainer = document.getElementById("output");
  while(gameContainer.firstChild) {
    gameContainer.removeChild(gameContainer.firstChild);
  }
  const game = State.game;
  const playersHeader = document.createElement("h2");
  playersHeader.appendChild(document.createTextNode("THE CONTENDERS"));
  gameContainer.appendChild(playersHeader);
  gameContainer.appendChild(getSeatListHtml(game.seats));
  const mapHeader = document.createElement("h2");
  mapHeader.appendChild(document.createTextNode("THE MAP"));
  gameContainer.appendChild(mapHeader);
  gameContainer.appendChild(getMapHtml(game.map));
}

function generateGame(event) {
  event.preventDefault();
  State.game = randomizeGame();
  populateGameHtml();
  console.log(JSON.stringify(State.game, null, 1));
}

loadState();
