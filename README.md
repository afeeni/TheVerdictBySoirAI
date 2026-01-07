# The Verdict by SoirAI

A multiplayer mobile party game built with React Native and Supabase where players vote on "who's most likely to..." prompts, then put the top suspect on trial.

## Overview

The Verdict is an interactive party game for 4-10 players. Players use their phones to anonymously vote on entertaining prompts about each other. After several rounds, the player with the most votes goes "on trial" in a hot seat phase where everyone votes guilty or not guilty on personal questions about them.

### Key Features

- **Multiplayer Real-time Gameplay**: 4-10 players per game with live synchronization
- **Profile System**: Mugshot-style photos with personalized facts
- **Two Game Phases**:
  - Voting rounds: "Who's most likely to..." questions
  - Hot seat trial: Guilty/Not guilty verdicts on the suspect
- **Game Modes**:
  - Standard: Regular gameplay
  - Drinking Mode: With drinking penalties (21+)
- **Question Packs**:
  - General (Free): 50+ party questions
  - SFW (Free): 50+ work/family-friendly questions
  - Premium packs: Spicy, College, Dating (requires subscription)
- **Subscription System**: Free tier with 2 games/month, Premium for unlimited
- **Real-time Updates**: Supabase Realtime for instant game synchronization

## Tech Stack

- **Frontend**: React Native 0.83.1
- **Backend**: Supabase
  - Authentication
  - PostgreSQL Database
  - Realtime subscriptions
  - Storage for photos
- **State Management**: Zustand
- **Navigation**: React Navigation
- **Camera**: react-native-vision-camera & react-native-image-picker
- **UI**: React Native Linear Gradient for visual effects

## Project Structure

```
TheVerdictBySoirAI/
├── src/
│   ├── assets/              # Static assets
│   ├── components/          # Reusable React components
│   ├── constants/           # App constants
│   ├── hooks/              # Custom React hooks
│   │   └── useGameRealtime.ts
│   ├── navigation/         # React Navigation setup
│   │   └── AppNavigator.tsx
│   ├── screens/            # Screen components
│   │   ├── AuthScreen.tsx
│   │   ├── ProfileSetupScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── CreateGameScreen.tsx
│   │   ├── JoinGameScreen.tsx
│   │   ├── LobbyScreen.tsx
│   │   ├── GameScreen.tsx
│   │   ├── ResultsScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── SubscriptionScreen.tsx
│   ├── services/           # API and external services
│   │   └── supabase.ts
│   ├── store/              # Zustand state stores
│   │   ├── authStore.ts
│   │   └── gameStore.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── database.ts
│   │   └── index.ts
│   └── utils/              # Utility functions
├── supabase/               # Supabase configuration
│   ├── schema.sql          # Database schema with RLS
│   ├── seed.sql           # Initial seed data
│   └── questions_seed.sql  # Game questions
├── ios/                    # iOS native code
├── android/                # Android native code
├── App.tsx                 # App entry point
└── package.json
```

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: >= 20
- **npm** or **yarn**
- **React Native CLI**: `npm install -g react-native-cli`
- **Xcode** (for iOS development - macOS only)
- **Android Studio** (for Android development)
- **CocoaPods** (for iOS dependencies): `sudo gem install cocoapods`
- **Supabase Account**: Create one at [supabase.com](https://supabase.com)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd TheVerdictBySoirAI
```

### 2. Install Dependencies

```bash
# Install JavaScript dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios
bundle install
bundle exec pod install
cd ..
```

### 3. Set Up Supabase

#### Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Note your project URL and anon key from Settings > API

#### Initialize the Database

1. In your Supabase dashboard, go to the SQL Editor
2. Run the following SQL files in order:
   - `supabase/schema.sql` - Creates tables, indexes, and RLS policies
   - `supabase/seed.sql` - Seeds initial data (if any)
   - `supabase/questions_seed.sql` - Loads game questions

#### Configure Storage

1. In Supabase dashboard, go to Storage
2. The `user-photos` bucket will be created automatically by the schema
3. Verify the bucket exists and storage policies are enabled

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Run the Application

#### For iOS:

```bash
npm run ios
```

Or open `ios/TheVerdictBySoirAI.xcworkspace` in Xcode and run.

#### For Android:

```bash
npm run android
```

Or open the `android` folder in Android Studio and run.

#### Start Metro Bundler:

```bash
npm start
```

## Database Schema

### Key Tables

**users**
- Stores user profiles with mugshot photos and personal facts
- Links to Supabase Auth

**game_rooms**
- Manages game sessions with join codes
- Tracks game mode, length, and status

**game_sessions**
- Stores current game state (round, phase, timer)
- Manages real-time game flow

**players**
- Links users to game rooms
- Tracks points and guilty verdicts

**votes**
- Stores all votes (suspect and verdict types)
- Ensures voting privacy

**question_packs** & **questions**
- Manages question content
- Supports free and premium packs

### Row Level Security (RLS)

All tables have RLS policies enabled to ensure:
- Users can only update their own profiles
- Players can only view game data for games they're in
- Votes remain anonymous
- Photos are accessible only to authenticated users

## Game Flow

1. **Authentication**: Users sign up/in with email and password
2. **Profile Setup**: Take mugshot photos and add personal facts
3. **Home Screen**: Host or join a game
4. **Create Game**: Host selects mode, pack, and game length
5. **Join Game**: Players enter 6-character join code
6. **Lobby**: Players wait, host starts when ready (4-10 players)
7. **Meet the Lineup**: Brief intro to all players
8. **Voting Phase**: 5-10 rounds of "most likely to" voting
9. **Hot Seat Trial**: Top suspect faces guilty/not guilty questions
10. **Results**: Final scores, "Most Guilty" award, drinking penalties
11. **Play Again**: Option to restart with same lobby

## Real-time Features

The app uses Supabase Realtime for:
- Player joins/leaves lobby
- Game phase transitions
- Vote submissions
- Timer synchronization
- Final results updates

## Subscription Model

### Free Tier
- Join unlimited games
- Host 2 games per month
- Access to General and SFW packs

### Premium Tier ($4.99/month)
- Host unlimited games
- All question packs unlocked
- Priority support
- No ads

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building for Production

#### iOS:

1. Open `ios/TheVerdictBySoirAI.xcworkspace` in Xcode
2. Select "Product" > "Archive"
3. Follow Apple's distribution process

#### Android:

```bash
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/`

## Troubleshooting

### iOS Build Issues

**Pod install fails:**
```bash
cd ios
rm -rf Pods
rm Podfile.lock
bundle install
bundle exec pod install
```

**Xcode version issues:**
- Ensure you're using the latest stable Xcode version
- Run `sudo xcode-select --switch /Applications/Xcode.app`

### Android Build Issues

**Gradle issues:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

**SDK not found:**
- Set `ANDROID_HOME` environment variable
- Ensure Android SDK is installed via Android Studio

### Supabase Connection Issues

- Verify your `.env` file has correct credentials
- Check Supabase project is active
- Ensure RLS policies are applied correctly

### Camera Permissions

**iOS:**
Add to `ios/TheVerdictBySoirAI/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take mugshot photos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to select profile photos</string>
```

**Android:**
Permissions are already configured in `android/app/src/main/AndroidManifest.xml`

## Known Issues & Limitations

- Timer synchronization may drift slightly across devices
- Requires stable internet connection for real-time gameplay
- Camera features require physical device (not simulator/emulator)
- Payment integration not yet implemented (subscription tracked in database only)

## Future Enhancements

- [ ] Payment integration (RevenueCat or Stripe)
- [ ] Custom question builder
- [ ] Game history and statistics
- [ ] Social sharing features
- [ ] Push notifications
- [ ] Additional question packs (18+, Couples, etc.)
- [ ] In-game chat
- [ ] Replay/highlights feature

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved by SoirAI

## Credits

Built with ❤️ by SoirAI

## Support

For support, email: support@soir.ai
