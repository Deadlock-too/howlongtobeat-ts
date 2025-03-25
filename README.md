# howlongtobeat-ts
[![GitHub](https://img.shields.io/github/license/Deadlock-too/howlongtobeat-ts)](https://github.com/Deadlock-too/howlongtobeat-ts)
[![npm](https://img.shields.io/npm/v/howlongtobeat-ts)](https://www.npmjs.com/package/howlongtobeat-ts)
[![npm](https://img.shields.io/npm/dt/howlongtobeat-ts)](https://www.npmjs.com/package/howlongtobeat-ts)

A TypeScript library for interacting with the HowLongToBeat website API. Easily search for games and retrieve estimates on how long it takes to complete them.

This project is heavily inspired by [howlongtobeat-js](https://github.com/toasttsunami/hltb-js/) by [toasttsunami](https://github.com/toasttsunami), but has been rewritten in TypeScript for improved type safety and maintainability.

As also noted by toasttsunami in his implementation, this library was created due to the inactivity of [ckatzorke's howlongtobeat](https://github.com/ckatzorke/howlongtobeat) project, which appears to be abandoned. Additionally, recent changes to the HowLongToBeat.com API have rendered it non-functional, making alternative solutions necessary.

> ⚠️ **Disclaimer:** This library is not an official API and is not affiliated nor endorsed with HowLongToBeat.com or Ziff Davis LLC
> in any way. Please use this library responsibly and do not abuse or overload the HowLongToBeat servers. Use at your own risk.

## Features

- Search for games on HowLongToBeat
- Retrieve completion time data for games
- TypeScript support with full type definitions

## Installation

Install the library via npm:
```bash
npm install howlongtobeat-ts
```

## Usage

```typescript
import { HowLongToBeatService, SearchModifier } from 'howlongtobeat-ts';

async function searchGame() {
  const hltbService = new HowLongToBeatService();
  
  // Search for a game
  const results = await hltbService.search('The Last of Us');
  
  if (results) {
    console.log('Search results:', results);
  }
}

// With search modifier
async function searchWithModifier() {
  const hltbService = new HowLongToBeatService();
  const results = await hltbService.search('Zelda', SearchModifier.HIDE_DLC);
  
  if (results) {
    console.log('Search results:', results);
  }
}

searchGame();
```

## API

### `HowLongToBeatService`

The main service class for interacting with the HowLongToBeat website.

#### Constructor

- `constructor(minSimilarity: number = 0.5)`: Creates an instance of the HowLongToBeatService class.
    - `minSimilarity`: Optional parameter to set the minimum similarity threshold for search results to not be filtered out (Default: 0.5).

#### Methods

- `async search(searchKey: string, searchModifier: SearchModifier = SearchModifier.NONE): Promise<HowLongToBeatEntry[]>`: Searches for games matching the provided search key.
    - `searchKey`: The game title to search for
    - `searchModifier`: Optional search modifier to adjust search behavior that defaults to `SearchModifier.NONE` allowing all results.

### `SearchModifier`
An enum representing different search modifiers that can be used to filter search results.
- `NONE`: No modifier, all results are returned.
- `HIDE_DLC`: Hides DLCs from the search results.
- `ONLY_DLC`: Only shows DLCs in the search results.

### `HowLongToBeatEntry`
An interface representing a game entry returned from the HowLongToBeat API.
- `id`: The unique identifier for the game.
- `name`: The name of the game.
- `mainTime`: The average time to complete the main story.
- `mainCount`: The number of users who reported the main story completion time.
- `mainExtrasTime`: The average time to complete the main story plus extras.
- `mainExtrasCount`: The number of users who reported the main story plus extras completion time.
- `completionistTime`: The average time to complete the game 100%.
- `completionistCount`: The number of users who reported the 100% completion time.
- `allStylesTime`: The average time to complete the game in all styles.
- `allStylesCount`: The number of users who reported the all styles completion time.
- `coopTime`: The average time to complete the game in co-op mode.
- `coopCount`: The number of users who reported the co-op completion time.
- `multiplayerTime`: The average time to complete the game in multiplayer mode.
- `multiplayerCount`: The number of users who reported the multiplayer completion time.
- `image`: The URL of the game's image.
- `reviewScore`: The review score of the game on HowLongToBeat.
- `platforms`: An array of platforms the game is available on.
- `similarity`: The similarity score of the game to the search query.
- `releaseYear`: The release year of the game.
- `json`: The raw JSON response from the HowLongToBeat API allowing for further inspection. 

## Development

### Prerequisites

- Node.js
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/Deadlock-too/howlongtobeat-ts.git

# Install dependencies
cd howlongtobeat-ts
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Issues, Questions & Discussions
If you found a bug, report it as soo as possible creating an [issue](https://github.com/Deadlock-too/howlongtobeat-ts/issues/new), the code is not perfect for sure, and I will be happy to fix it.
If you need any new feature, or want to discuss the current implementation/features, consider opening a [discussion](https://github.com/Deadlock-too/howlongtobeat-ts/discussions/) or even propose a change with a [Pull Request](https://github.com/Deadlock-too/howlongtobeat-ts/pulls).

## License
This project is licensed under the MIT License - see the <a href="https://github.com/Deadlock-too/howlongtobeat-ts/blob/main/LICENSE" target="_blank">LICENSE</a> file for details.
