# Chroma

A perfect-pitch and ear-training PWA with a daily practice reminder.

**Live:** https://chroma-cyan-tau.vercel.app (on iPhone, Share → Add to Home Screen to get reminders)

- **Notes**: learn the 12 pitches one at a time, a ladder of levels per note
- **Ear games**: intervals, chords, progressions, scales, keys, and singing a note back
- **Tuner**: hum, sing or whistle and see the note
- **Daily reminder**: a web push at the time you pick

## Stack

Next.js, Tailwind, Web Audio, [pitchy](https://github.com/ianprime0509/pitchy) for pitch detection, and Convex + web-push for reminders. Progress stays on the device.

## Run

```sh
npm install
npx convex dev   # first run creates a Convex project
npm run dev
```

Reminders need VAPID keys (`npx web-push generate-vapid-keys`):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in Convex (`npx convex env set …`)

## Deploy

```sh
scripts/deploy.sh   # convex deploy, then vercel --prod
```

## Credits

- Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0)
- Other instruments: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (CC BY 3.0)
- The note-learning method follows Wong et al., 2025
