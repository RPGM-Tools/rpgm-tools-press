# AI Use, Disclosure, and Accountability

This project uses generative AI as a development tool. That use is material,
not incidental, and this document exists to disclose it plainly.

The primary AI tool used during development has been Claude (Anthropic),
primarily through Claude Code. It has been used to scaffold the site, draft
and revise TypeScript/Astro components, draft blog post prose from rough
notes, and write the release-notes sync tooling.

This document was also prepared with AI assistance.

## Governing principle: human-first, AI-augmented

**AI may propose. The maintainer decides, verifies, and owns the result.**

AI output is treated as working material, not as authority. No change is
accepted merely because an AI system produced it or explained it convincingly.
Design decisions, visual direction, what gets published, and release
decisions remain human decisions.

## What AI is used for

Implementation drafting, component scaffolding, styling, and the mechanical
parts of the release-aggregation tooling. It is not used to decide what a
blog post says about the maintainer's own work or opinions - AI-drafted
prose is reviewed and edited before publishing, the same as any other draft.

Site search also uses machine-learning embeddings. Entry vectors are generated
from published content during content sync/deploy and stored with the site. A
visitor's search text is sent to Cloudflare Workers AI only after the local
Pagefind full-text index returns zero matching entries; the returned query
vector is compared with the static entry vectors in the visitor's browser.

## Licensing and security

AI-generated code is reviewed with the same standard as human-written code.
Dependencies and APIs it suggests are verified before use. Secrets and
credentials are never supplied to an AI service as development context.

## What this policy does not claim

This project does not claim generative AI is error-free or a replacement for
review. It states something narrower: this project uses AI, the use is
disclosed, and the maintainer remains accountable for everything published.
