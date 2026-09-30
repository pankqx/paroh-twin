# Paroh — student digital twin

Paroh is a hackathon prototype that uses approved student planning facts to derive patterns, compare what-if scenarios, and explain recommendations. The app includes clearly labelled sample student data. It is a planning tool, not a therapy or mental-health product. AI calls run on the server; OpenRouter is the default hosted provider and consent filters the data sent to it.

## AI configuration

Copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and optionally `OPENROUTER_FALLBACK_MODEL`. `LLM_BASE_URL` defaults to `https://openrouter.ai/api/v1`. To use an OpenAI-compatible local service such as Ollama, set `LLM_BASE_URL` to its `/v1` base URL and set `OPENROUTER_MODEL` to a model available there; a key is not required for a custom base URL.

LLM output only structures text. Scenario probabilities and student patterns are computed in TypeScript. If a provider is unavailable, the engine uses canned results.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
