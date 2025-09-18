# Sol Arena Environment Setup

## Required Environment Variables

Create a `.env.local` file in the `SolxArena` directory with the following variables:

```env
# Helius API Configuration (Primary - for token holder data)
NEXT_PUBLIC_HELIUS_API_KEY=5ce963f9-e31d-48de-88b6-886167f9c8c6

# PumpPortal API Configuration (Secondary - for real-time trading data)
NEXT_PUBLIC_PUMPPORTAL_API_KEY=5d36rcvu5xqqgrhnex37gh1k8wqnepjbct552jaj71nm2ja2axc6at3jatr62pbq6n750h2h60wkgk2p8hmpju2aegvjyub1et8peuv66923jy2udx478hjpf1c2ywkuet4qcubc84ykub8rqagbpdrr70hkd90unjp3a8w5d83gp3b75wp8dubf10ncgbfa9q3jpb46h0kuf8
```

## API Usage

### Helius API
- **Purpose**: Fetch complete token holder lists with pagination
- **Endpoint**: `https://api.helius.xyz/v0/token-accounts`
- **Rate Limits**: 1M credits/month (free tier)
- **Max per request**: 1,000 token accounts

### PumpPortal API  
- **Purpose**: Real-time trading data and WebSocket streams
- **WebSocket**: `wss://pumpportal.fun/api/data?api-key=KEY`
- **Rate Limits**: Aggressive connection limiting on free tier

## Token Requirements

### Pump.fun Token Specifications
- **Decimals**: 6 (not the standard 9)
- **Total Supply**: 1,000,000,000 (1 billion)
- **Program ID**: `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`

### Example Token Addresses for Testing
```
# Popular pump.fun tokens (use for testing)
PNUT: 2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump
GOAT: CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump
MOODENG: ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY
```

## Setup Instructions

1. Copy the environment variables to `.env.local` in the SolxArena directory
2. Restart the development server: `npm run dev`
3. The app will automatically detect the API keys and switch from demo mode
4. Test with a real pump.fun token address

## Demo Mode

If no API keys are provided, the app runs in demo mode with:
- Mock token holder data
- Simulated blockchain interactions
- All game mechanics functional for testing

## Production Deployment

For production deployment:
1. Set environment variables in your hosting platform
2. Ensure API keys have sufficient rate limits
3. Consider implementing caching for token holder data
4. Add error handling for API failures
